# Always-Transform + Lighting Design

**Date:** 2026-02-21
**Status:** Approved
**Principle:** KISS, YAGNI, SOLID

## Problem

The existing transform/lighting pipeline had multiple competing dirty-check layers
(`_instanceMatrixDirty`, lighting version, matrix comparison, camera comparison) that
interacted in complex ways and missed updates — most visibly: moving spotlights not
updating on static (non-animated) objects.

## Decision

Eliminate all dirty checks for lighting and transform. Every frame, every non-baked
object runs the full transform+lighting pass. Bake is a per-object toggle to opt out.

## The New `_tick()` Loop

```
if animated and playing and shouldUpdate:
    update bones → queueSkinning(lightConfig)   // unchanged
else if not baked and shouldUpdate:
    forceStaticTransformAndLighting(lightConfig) // always, no conditions
// baked: do nothing (frozen GPU buffers)
updateRender()
```

Frame skip (`shouldUpdate`) still gates the whole update uniformly.

## What Gets Deleted

| Location | Removed |
|---|---|
| `GltfModel` | `queueStaticLighting()`, `_lastStaticLightingVersion`, `_lastStaticLightingMatrix`, `_lastCameraPosition`, `setInstanceMatrix()`, `_lastInstanceMatrix`, `_hasInstanceMatrixChanged()` |
| `instance.ts` | `_instanceMatrixDirty`, `_lastX/Y/Z/Angle`, `_applyLightingToAllMeshes()`, `didTransformWithLighting` |
| `TransformWorkerPool.ts` | `LIGHTING_BATCH` handler, `queueStaticLighting()` method |

## What Stays

- `STATIC_TRANSFORM_AND_LIGHTING` worker path (now the only path)
- `forceStaticTransformAndLighting()` (renamed/used as the single update method)
- `queueSkinning` for animated meshes
- `REGISTER_STATIC_LIGHTING` (positions/normals registered at load)
- Bake toggle ACEs: `BakeLighting`, `UnbakeLighting`, `IsLightingBaked`
- Frame skip / distance LOD

## Bake Toggle

- **On**: GPU buffers frozen. Per-frame pass skipped for this object.
- **Off**: Per-frame pass resumes next `shouldUpdate` frame automatically.
- **Normals preserved**: The memory-saving normals-free optimization in `bakeLighting`
  is removed — normals must be kept so unbaking works.
- **No new API**: existing `BakeLighting` / `UnbakeLighting` / `IsLightingBaked` ACEs unchanged.

## Double-Transform Bug Fix (already applied)

In `STATIC_TRANSFORM_AND_LIGHTING`, `calculateLighting` now receives `entry.positions`
(original model-space) + `instanceMatrix` — not `packedPositions` (already world-space).
Previously this double-transformed vertex positions, sending spotlight distance
calculations into garbage space and killing spotlight contribution on the first frame.

## Trade-offs Accepted

- More GPU work per frame for static objects (positions re-uploaded even when unchanged).
- Simpler, more correct, zero edge cases. Accepted per KISS/YAGNI.
