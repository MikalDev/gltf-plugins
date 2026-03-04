# Initial Pose Flash — Investigation & Fix

## Problem

On first render, a glTF model briefly appeared in its bind pose without the instance's
scale/rotation applied. The flash was visible for several frames before the correct pose appeared.

## Root Cause

Vertex positions are transformed by async workers (skinning + static lighting). The mesh
buffers are initialised to bind-pose local space from the `AnimationController` constructor.
Workers apply the instance TRS matrix and write correct world-space positions back, but this
round-trip takes multiple frames:

1. `_tick()` queues transform work, calls `scheduleFlush()` (sets a flag)
2. `_tick2()` calls `flushIfPending()` → `flush()` → `postMessage` to workers
3. Workers parse/compile script on **first use** (50–200 ms startup cost), then process and reply
4. `_handleMessage()` → `_invokeAllCallbacks()` → positions written to `_meshData`

On first use the worker initialisation alone spans several frames, so a 1–2 tick guard is
not enough.

## Fix Applied

Two changes in `instance.ts`:

**1. Always apply skinned mesh transforms (not just when animating)**

Previously `_updateSkinnedMeshes()` was only called when animation was playing. The instance
TRS was therefore never applied to a model in its initial bind pose.

```typescript
// Now runs every tick regardless of animation state
if (this._animationController && this._model) {
    this._model.updateJointNodes(this._animationController);
    this._model.updateStaticMeshTransforms();
    this._updateSkinnedMeshes();
}
```

**2. Suppress draw until workers have had time to respond**

```typescript
// Field
_tickCount: number = 0;

// End of _tick()
this._tickCount++;

// _draw()
if (this._model?.isLoaded && this._tickCount >= 10) { ... }
```

10 ticks (≈167 ms at 60 fps) covers the worker cold-start penalty on first use.
Subsequent frames are fast — workers are already warm.

## Why 10 Ticks?

Worker cold-start dominates. The first `flush()` triggers script parse + compile inside
the worker thread. Until that completes no response arrives and the buffers still hold
bind-pose data. Empirically, 10 ticks was the minimum needed to avoid the flash.

---

## Plan: Investigate Worker Warm-Up

**Goal:** Reduce the suppress window to 2–3 ticks by ensuring workers are fully initialised
before the first draw request.

### Step 1 — Measure actual worker latency (no code changes)

Add a `performance.now()` timestamp in `_tick()` when `_tickCount === 0` (first tick), and
log when the first worker result arrives (first call to `_applyPositions` / `applyTransformedData`).
This tells us exactly how many ms the cold-start costs in practice.

### Step 2 — Send a warm-up ping during model registration (one line)

In `_registerSkinnedMeshesWithPool()` and `_registerStaticMeshesForLightingWithPool()`, after
transferring mesh data to the worker, send a no-op message:

```typescript
this._workers[workerIndex].postMessage({ type: "PING" });
```

The worker already receives messages on load; adding a `case "PING": break;` costs nothing.
This forces the worker thread to fully initialise its script before the first real request.

### Step 3 — Re-test with the reduced tick threshold

After the warm-up ping, re-test with `_tickCount >= 2`. If the flash is gone, keep it.
If not, measure again (Step 1) to see what the remaining delay is.

### Step 4 — Lower threshold or make it data-driven (only if needed)

If 2 ticks is still not reliable, consider `>= 3` or `>= 4`. Do **not** build a dynamic
callback-based detection system — the tick counter is simple, correct, and easy to reason about.
