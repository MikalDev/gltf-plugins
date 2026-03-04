# Using Rapier 3D Physics Raycasting from Another Addon

This guide shows how a C3 addon (plugin or behavior) can fire raycasts and shape casts against the Rapier 3D Physics world and read results one tick later.

The pattern described here is **object-to-light occlusion testing**: a ray is cast FROM the rendered object TOWARD each light source to determine whether that light is blocked (shadowed) or visible (lit).

---

## Prerequisites

- The **rendered object** must have the **Rapier 3D Physics** behavior attached (`mikal_cannon_3d_physics`)
- The physics world must be initialized (after `OnPhysicsReady`)
- Your addon must use **C3 SDK v2**

---

## How It Works

Raycasts are **fire-and-forget**. The command is queued to the physics worker on tick N. The worker processes it during `stepWorld` and the result is stored on the physics behavior instance. Your addon reads it on tick N+1.

```
Tick N:   rendered object fires _Raycast(tag, objectPos → lightPos)
           → command queued to physics worker

Tick N+1: worker result arrives → stored in raycastResults Map by tag
           → your addon reads _RaycastResultAsJSON(tag)
           → hasHit = true  → light is BLOCKED  (object is in shadow)
           → hasHit = false → light is VISIBLE   (object is lit)
```

---

## Step 1 — Access the Physics Behavior

The physics behavior is on the **rendered object** — the same instance your addon is attached to:

```js
_getPhysicsBehavior() {
    return this.instance.behaviors.mikalCannon3dPhysics ?? null;
}
```

Guard every use — the behavior may not be attached:

```js
const phys = this._getPhysicsBehavior();
if (!phys) return;
```

---

## Step 2 — Choose a Stable Tag

Each raycast result is stored in a `Map<tag, result>`. Use a **stable, unique tag per ray** so results are never ambiguous.

A tag encodes three things: addon namespace, instance identity, and ray slot identity.

```js
// For multiple lights, one ray per light index
// lightIndex is a fixed integer assigned at registration time, not a dynamic value
_tagForLight(lightIndex) {
    return `myAddon-${this.instance.uid}-${lightIndex}`;
}
```

Rules:
- **One tag per ray slot** — tag is the key, duplicate tags in the same tick overwrite each other
- **Keep tags fixed** — `uid` and `lightIndex` are stable; never use frame counters or random values
- **Namespace your tags** — prefix with your addon ID to avoid collisions with other addons
- **Light index is not the light's UID** — it is a logical slot number (0, 1, 2…) assigned when the light is registered, not a C3 object UID

Tag anatomy:

```
"myAddon-1042-3"
 ──────── ──── ─
    │      │   └─ lightIndex: ray slot (0, 1, 2…) — logical, not a UID
    │      └───── rendered object uid: unique and stable for this instance
    └──────────── addon prefix: avoids collision with other addons
```

---

## Step 3 — Fire and Read in `_tick()`

The two-phase pattern: read last tick's results first, then fire new raycasts for this tick.

`_Raycast` does not expose an `excludeUID` parameter, so there is no built-in way to skip the originating object. If self-intersection is a problem (ray immediately hits the object's own collider at distance ~0), offset the origin by a small amount in the direction of the light before firing.

```js
_postCreate() {
    this._lightIndex = 0; // fixed slot assigned by your light registration logic
    this._rayPending = false;
    this._lastRayResult = null;
}

_tick() {
    const phys = this._getPhysicsBehavior();
    if (!phys) return;

    const inst = this.instance;
    const tag = this._tagForLight(this._lightIndex);

    // Phase 1: read result from last tick
    if (this._rayPending) {
        this._lastRayResult = JSON.parse(phys._RaycastResultAsJSON(tag));
        this._rayPending = false;
    }

    // Phase 2: fire ray from this object toward the light
    // Light position must be read fresh each tick — lights can move
    const lightX = ...; // current light world X
    const lightY = ...; // current light world Y
    const lightZ = ...; // current light world Z

    phys._Raycast(
        tag,
        inst.x, inst.y, inst.zElevation, // origin: this object's position
        lightX, lightY, lightZ,           // target: light position
        0,     // filterGroups: 16-bit filter mask (0 = hit all groups; see Light Occluder section)
        0,     // mask: unused, pass 0
        false, // skipBackfaces: true = ignore back-facing triangle normals
        0      // mode: unused, pass 0 (always returns closest hit)
    );
    this._rayPending = true;
}
```

---

## Step 4 — Read the Result

```js
const result = this._lastRayResult;

if (!result) return; // not yet available (tick 0)

if (result.hasHit) {
    // Light is BLOCKED — object is in shadow for this light
    const blockerUID = result.hitUID; // which object is casting the shadow
} else {
    // Light is VISIBLE — object is lit by this light
}
```

Full result schema:

| Field | Type | Description |
|---|---|---|
| `hasHit` | boolean | `true` = light blocked (shadowed), `false` = light visible (lit) |
| `hitUID` | number | UID of the blocking object (`-1` if no hit) |
| `normal` | `{x, y, z}` | Surface normal at the hit point |
| `timeOfImpact` | number | Rapier time-of-impact scalar (0–1 over the ray's full length) |
| `origin` | `{x, y, z}` | Ray origin in world units |
| `dir` | `{x, y, z}` | Normalized ray direction |
| `uid` | number | UID of the instance that fired the ray |
| `tag` | string | Echo of the tag used |

> **Hit position** is not stored directly. Compute it as: `origin + dir * timeOfImpact * rayLength`, where `rayLength` is the distance between the origin and target points you passed to `_Raycast`.

---

## Multiple Lights Per Object

Each rendered object fires one ray per light. Light positions are fetched live each tick — lights can move.

```js
_postCreate() {
    this._uid = this.instance.uid;
    // Each entry: { lightIndex, getLightPos }
    // getLightPos is a function that returns { x, y, z } of the light each tick
    this._lights = [];
    this._pending = false;
    this._results = new Map(); // keyed by lightIndex: { hasHit, hitUID, timeOfImpact, normal, ... }
}

// Register a light. lightIndex is sequential (0, 1, 2…), never the light's C3 UID.
// getLightPos is called every tick to get the current light world position.
_addLight(lightIndex, getLightPos) {
    this._lights.push({ lightIndex, getLightPos });
}

_tagForLight(lightIndex) {
    return `myAddon-${this._uid}-${lightIndex}`;
}

_tick() {
    const phys = this._getPhysicsBehavior();
    if (!phys) return;

    const inst = this.instance;

    // Phase 1: read results from last tick
    if (this._pending) {
        for (const light of this._lights) {
            const tag = this._tagForLight(light.lightIndex);
            const result = JSON.parse(phys._RaycastResultAsJSON(tag));
            this._results.set(light.lightIndex, result);
        }
        this._pending = false;
    }

    // Phase 2: fire a ray toward each light from this object's current position
    for (const light of this._lights) {
        const tag = this._tagForLight(light.lightIndex);
        const { x: lx, y: ly, z: lz } = light.getLightPos(); // live position
        phys._Raycast(
            tag,
            inst.x, inst.y, inst.zElevation, // origin: this object
            lx, ly, lz,                       // target: light
            0, 0, false, 0
        );
    }

    if (this._lights.length > 0) this._pending = true;
}

// Query occlusion for a specific light by its index
isLitByLight(lightIndex) {
    const result = this._results.get(lightIndex);
    return result ? !result.hasHit : false;
}
```

Usage — registering lights:

```js
// lightIndex is your addon's slot counter, incremented per light added
// getLightPos reads the light object's live C3 position
obj._addLight(0, () => ({ x: lightInst.x, y: lightInst.y, z: lightInst.zElevation }));
obj._addLight(1, () => ({ x: light2Inst.x, y: light2Inst.y, z: light2Inst.zElevation }));
```

---

## Light Occluder Collision Group

To avoid testing every physics body in the scene (which is wasteful), tag only the objects that should block light. A reserved collision group bit makes this precise and zero-cost at query time.

**Bit 15 (`0x8000`) is reserved as the light occluder group.** Objects not in this group are invisible to light raycasts.

### Marking an object as a light occluder

From the event sheet:
```
Set [PhysicsObject] light occluder: true
```

From JS:
```js
physicsInst.behaviors.mikalCannon3dPhysics._SetLightOccluder(true);
```

This sets bit 15 in the body's collision membership without disturbing any other group bits. Existing collision behaviour with other bodies is unchanged.

### Raycasting only against occluders

The `filterGroups` parameter you pass is a **16-bit filter mask** — not Rapier's full 32-bit value. The worker constructs the complete `(membership << 16) | filter` encoding for you.

Pass `"0x8000"` as `filterGroups` to tell the worker: "only report hits against bodies whose membership includes bit 15."

```js
phys._Raycast(
    tag,
    inst.x, inst.y, inst.zElevation,  // origin: rendered object
    lx, ly, lz,                        // target: light position
    "0x8000",  // ← 16-bit filter mask: only hit light occluders
    0,
    false,
    0
);
```

Internally, the worker builds the full 32-bit Rapier filter value as:
```
filterGroups = 0xFFFF0000 | 0x8000 = 0xFFFF8000
              ──────────   ───────
              membership   filter
              (ray hits    (only bodies
               from all    in group 15)
               groups)
```

This matches the Rapier filter convention: `(membership << 16) | filter`. Two-body collision resolution requires both sides to agree — for raycasts Rapier only checks the filter side, so the ray's membership is set to `0xFFFF` (all groups) and only the filter matters.

### Group bit summary

| Bit | Value | Reserved for |
|---|---|---|
| 0–13 | `0x0001`–`0x2000` | General use |
| 14 | `0x4000` | Available |
| **15** | **`0x8000`** | **Light occluders** |

---

## Shape Cast

Identical pattern — replace `_Raycast` / `_RaycastResultAsJSON` with `_CastShape` / `_CastShapeResultAsJSON`. Use a sphere or capsule shape for soft-edge occlusion (penumbra approximation).

Unlike `_Raycast`, `_CastShape` does expose an `excludeUID` parameter, so you can pass `this.instance.uid` directly to skip the originating object without needing an origin offset.

```js
phys._CastShape(
    tag,
    1,               // shapeType: 1=sphere
    radius,          // height (sphere uses this as radius)
    radius,          // width
    radius,          // depth
    0, 0, 0,         // rotation
    inst.x, inst.y, inst.zElevation, // origin: this object
    lx, ly, lz,                      // target: light
    0,               // maxToI (0 = derive from distance)
    0,               // targetDistance
    0,               // filterGroups (16-bit filter mask, same as _Raycast)
    this.instance.uid, // excludeUID: skip the originating object (-1 = none)
    false            // skipBackfaces
);
```

Shape cast result schema:

| Field | Type | Description |
|---|---|---|
| `hasHit` | boolean | `true` = light blocked, `false` = lit |
| `hitUID` | number | UID of the blocking object (`-1` if no hit) |
| `time_of_impact` | number | Distance travelled before contact (Rapier TOI scalar) |
| `witness1` | `{x, y, z}` | Closest point on cast shape at contact |
| `witness2` | `{x, y, z}` | Closest point on hit collider at contact |
| `normal1` | `{x, y, z}` | Normal on cast shape at contact |
| `normal2` | `{x, y, z}` | Normal on hit collider at contact |
| `origin` | `[x, y, z]` | Cast origin in world units |
| `direction` | `[x, y, z]` | Cast direction (normalized) |
| `uid` | number | UID of the instance that fired the cast |
| `tag` | string | Echo of the tag used |

---

## Reacting to Results

### From C3 event sheets

The physics behavior fires two trigger conditions each time a raycast result arrives:

- **On any raycast result** — fires for every result, regardless of tag
- **On raycast result [tag]** — fires only when the current tag matches the parameter you provide

In the event sheet, add a condition block on the physics object:
```
Physics: On raycast result "myAddon-[uid]-0"
    → read _RaycastResultAsJSON("myAddon-[uid]-0")
```

`_currentRaycastTag` is available as an expression to read the tag that just fired.

Equivalent triggers exist for shape casts: **On any cast shape result** and **On cast shape result [tag]**.

### From JS scripting (addon or behavior code)

C3 behavior instances use C3's internal trigger system, not DOM `EventTarget`. There is no `addEventListener` on behavior instances.

The recommended approach is the polling pattern already shown in Step 3 (`_tick` Phase 1 / Phase 2). Results are stored persistently in the `raycastResults` Map until overwritten — they are available any time after the tick they arrived.

If you need to react synchronously in the same tick a result is processed (not recommended for most use cases), read `_currentRaycastTag` directly during the C3 condition evaluation cycle:

```js
// Only valid inside a C3 condition method called by _trigger() —
// NOT in arbitrary async code.
const tag = phys._currentRaycastTag;
const result = JSON.parse(phys._RaycastResultAsJSON(tag));
```

---

## Tick Ordering

C3 does not guarantee the order `_tick()` runs across different addon instances. This is safe because:

- Results are stored in a persistent `Map` — they survive until overwritten by a new result for the same tag
- Reading on tick N+1 always finds the tick-N result regardless of whether your tick runs before or after the physics behavior's tick

Do **not** read in the same tick you fire — the worker hasn't processed the command yet.

---

## Common Mistakes

| Mistake | Problem | Fix |
|---|---|---|
| Reading result same tick as firing | Worker hasn't run yet — result is stale | Always read one tick after firing |
| Not reading light position fresh each tick | Stale position if light has moved | Call `getLightPos()` inside `_tick()`, not at registration |
| Dynamic tags (`"ray-" + frameCount`) | Map grows unboundedly | Use fixed tags per ray slot |
| Using light's C3 UID as light index | If two different rendered objects both use the light's C3 UID as the slot number, they generate identical tags (e.g. `"myAddon-1001-42"` and `"myAddon-1002-42"` are fine, but if uid is the light UID both objects share the same `lightIndex` value for that light and could overwrite each other's results in edge cases) | Use a sequential index assigned at registration time per rendered object — `0, 1, 2…` — not the light's UID |
| No `hasHit` check before reading fields | `normal`, `timeOfImpact`, `witness1/2` etc. are absent or zero on a miss | Always check `result.hasHit` first |
| No null guard on `_getPhysicsBehavior()` | Crashes if behavior not attached | Guard every access |
| Calling `_Raycast` before `OnPhysicsReady` | World not initialized — result is always `hasHit: false` | Wait for physics world ready |
| Ray origin inside own collider | Ray immediately hits self — always shadowed | Offset origin slightly toward light (`_Raycast` has no `excludeUID`); use `_CastShape` with `excludeUID` instead if needed |
