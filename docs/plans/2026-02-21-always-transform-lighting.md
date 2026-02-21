# Always-Transform + Lighting Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate all dirty-check heuristics for transform and lighting — every non-baked object runs the full transform+lighting pass every `shouldUpdate` frame.

**Architecture:** One code path for static objects (`forceStaticTransformAndLighting`), one for animated (`queueSkinning`). `LIGHTING_BATCH` worker handler deleted. Bake is a simple on/off toggle that skips the per-frame pass.

**Tech Stack:** TypeScript, Web Workers (inlined string), gl-matrix, C3 SDK v2

---

### Task 1: Rewrite `_tick()` in instance.ts — remove all dirty tracking

**Files:**
- Modify: `packages/gltf-static/c3runtime/instance.ts`

**What to remove from class fields:**
```typescript
// DELETE these fields entirely:
_instanceMatrixDirty: boolean = true;
_lastX: number = 0;
_lastY: number = 0;
_lastZ: number = 0;
_lastAngle: number = 0;
```

**What to remove as methods:**
- `_applyLightingToAllMeshes()` — entire method, gone
- `_markTransformDirty()` — entire method, gone
- All calls to `_markTransformDirty()` in: `_setRotation()`, `_setScale()`, `_setScaleXYZ()`, `_setRotationQuaternion()` (just delete those lines)

**Replace entire `_tick()` with:**
```typescript
_tick(): void
{
    if (!this._model?.isLoaded) return;

    const dt = this.runtime.dt;
    this._accumulatedDt += dt;
    this._frameCounter++;

    const effectiveFrameSkip = this._distanceLodEnabled
        ? this._calculateDistanceFrameSkip()
        : this._animationFrameSkip;
    const updateInterval = effectiveFrameSkip + 1;
    const shouldUpdate = ((this._frameCounter + this._frameOffset) % updateInterval) === 0;

    if (!shouldUpdate)
    {
        this.runtime.sdk.updateRender();
        return;
    }

    // Always rebuild instance matrix from current TRS — no dirty check
    this._buildInstanceMatrix();

    // Animation update (skinned meshes — lighting included via queueSkinning)
    if (this._animationController?.isPlaying() && !this._animationController.isPaused())
    {
        this._animationController.update(this._accumulatedDt);
        this._model.updateJointNodes(this._animationController);
        this._model.updateStaticMeshTransforms();
        this._updateSkinnedMeshes();
        this._accumulatedDt = 0;
    }
    else
    {
        this._accumulatedDt = 0;
    }

    // Always transform + light all registered static meshes unless baked
    if (!this._isLightingBaked())
    {
        const lightConfig = this._buildLightConfig();
        this._model.forceStaticTransformAndLighting(this._instanceMatrix, lightConfig);
    }

    this.runtime.sdk.updateRender();
}
```

**Step 1:** Make the edits above to instance.ts

**Step 2:** Run `npm run build:static` — expect TypeScript errors referencing removed state or deleted methods; fix each one

**Step 3:** Commit
```bash
git add packages/gltf-static/c3runtime/instance.ts
git commit -m "refactor: rewrite _tick with always-transform, remove dirty tracking"
```

---

### Task 2: Update GltfModel.ts — update `forceStaticTransformAndLighting`, remove `setInstanceMatrix` and `queueStaticLighting`

**Files:**
- Modify: `packages/gltf-static/c3runtime/gltf/GltfModel.ts`

**Update `forceStaticTransformAndLighting` signature to accept the matrix:**
```typescript
/**
 * Always queue transform+lighting for all registered static meshes.
 * Updates the stored instance matrix and queues STATIC_TRANSFORM_AND_LIGHTING.
 * No dirty check — always runs.
 */
forceStaticTransformAndLighting(matrix: Float32Array, lightConfig: WorkerLightConfig): void {
    this._instanceMatrix.set(matrix);
    this._queueStaticTransforms(lightConfig);
}
```
(The extra `SharedWorkerPool.scheduleFlush()` that was there is already called inside `_queueStaticTransforms` — remove the duplicate.)

**Remove entirely from GltfModel:**
- `setInstanceMatrix()` method
- `_lastInstanceMatrix` field
- `_hasInstanceMatrixChanged()` private method
- `queueStaticLighting()` method
- `_lastStaticLightingVersion` field
- `_lastStaticLightingMatrix` field
- `_lastCameraPosition` field
- `_hasMatrixChanged()` private method (used only by queueStaticLighting)
- `_hasCameraPositionChanged()` private method (used only by queueStaticLighting)

**Step 1:** Make the edits above

**Step 2:** Run `npm run build:static` — fix any TypeScript errors

**Step 3:** Commit
```bash
git add packages/gltf-static/c3runtime/gltf/GltfModel.ts
git commit -m "refactor: remove setInstanceMatrix/queueStaticLighting dirty checks from GltfModel"
```

---

### Task 3: Remove `LIGHTING_BATCH` from the worker and `queueStaticLighting` from TransformWorkerPool

**Files:**
- Modify: `packages/gltf-static/c3runtime/gltf/TransformWorkerPool.ts`

**In the inlined `WORKER_CODE` string — remove the entire `case "LIGHTING_BATCH":` block** (from the `case` line through `break;`). It is only used by `queueStaticLighting` which is now gone.

**In the `TransformWorkerPool` class — remove:**
- `queueStaticLighting()` method
- `_pendingLightingByWorker` field and its initialization in constructor
- `PendingLightingRequest` interface (if defined)
- The `isLighting` branch in `_invokeAllCallbacks()` and `flushIfPending()` that processes LIGHTING_BATCH responses

**In `StaticLightingRegistration` interface — remove `callback` field** (only used for LIGHTING_BATCH responses); keep `workerIndex` for worker routing used by `queueStaticTransformAndLighting`.

**In `registerStaticMeshForLighting()` — remove `callback` parameter** since it's no longer stored or called. Update the call in `GltfMesh.registerStaticLightingWithPool()` to not pass a callback.

**Step 1:** Make the edits above

**Step 2:** Run `npm run build:static` — fix any TypeScript errors

**Step 3:** Commit
```bash
git add packages/gltf-static/c3runtime/gltf/TransformWorkerPool.ts \
         packages/gltf-static/c3runtime/gltf/GltfMesh.ts
git commit -m "refactor: remove LIGHTING_BATCH worker path and queueStaticLighting"
```

---

### Task 4: Remove `modelMatrix` from `WorkerLightConfig` and `_buildLightConfig()`

**Files:**
- Modify: `packages/gltf-static/c3runtime/gltf/TransformWorkerPool.ts`
- Modify: `packages/gltf-static/c3runtime/instance.ts`

`modelMatrix` in `WorkerLightConfig` was only used by `LIGHTING_BATCH` (gone) and set to `null` for skinning. It is NOT used by `STATIC_TRANSFORM_AND_LIGHTING` (which takes `instanceMatrix` via the request object).

**In `WorkerLightConfig` interface — remove:**
```typescript
modelMatrix: Float32Array;  // DELETE this field
```

**In `instance._buildLightConfig()` — remove:**
```typescript
modelMatrix: new Float32Array(this._buildModelRotationMatrix())  // DELETE
```
Also remove the return type annotation's `modelMatrix` field.

**In `instance._updateSkinnedMeshes()` — remove:**
```typescript
lightConfig.modelMatrix = null as unknown as Float32Array;  // DELETE — field no longer exists
```

**Step 1:** Make the edits above

**Step 2:** Run `npm run build:static` — fix any TypeScript errors

**Step 3:** Commit
```bash
git add packages/gltf-static/c3runtime/gltf/TransformWorkerPool.ts \
         packages/gltf-static/c3runtime/instance.ts
git commit -m "refactor: remove modelMatrix from WorkerLightConfig"
```

---

### Task 5: Fix bake toggle — preserve normals, simplify bake methods

**Files:**
- Modify: `packages/gltf-static/c3runtime/gltf/GltfMesh.ts`
- Modify: `packages/gltf-static/c3runtime/instance.ts`

**In `GltfMesh.bakeLighting()` — remove `freeNormals` parameter entirely:**
```typescript
bakeLighting(): void {
    this._lightingBaked = true;
    // Normals always preserved — bake is a toggle, unbake must work
}
```
Also update `GltfMesh.refreshLightingAndBake()` to not pass `freeNormals`.

**In `instance._bakeLighting()` — remove `_applyLightingToAllMeshes()` call (method is gone), change `bakeLighting(true)` to `bakeLighting()`:**
```typescript
_bakeLighting(): void {
    if (!this._model) return;
    for (const mesh of this._model.meshes)
    {
        if (mesh.hasNormals && !mesh.isSkinned)
        {
            mesh.bakeLighting();
        }
    }
}
```

**In `instance._refreshAndBakeLighting()` — simplify (remove use of deleted `_buildModelRotationMatrix` for lighting, just bake current state):**
```typescript
_refreshAndBakeLighting(): void {
    if (!this._model) return;
    for (const mesh of this._model.meshes)
    {
        if (mesh.hasNormals && !mesh.isSkinned)
        {
            mesh.bakeLighting();
        }
    }
}
```
(The per-frame pass will have already applied current lighting. Baking freezes that state.)

**Step 1:** Make the edits above

**Step 2:** Run `npm run build:static` — fix any TypeScript errors

**Step 3:** Commit
```bash
git add packages/gltf-static/c3runtime/gltf/GltfMesh.ts \
         packages/gltf-static/c3runtime/instance.ts
git commit -m "fix: preserve normals in bakeLighting, simplify bake toggle"
```

---

### Task 6: Build final, revert previously broken attempts, verify

**Files:**
- `packages/gltf-static/c3runtime/instance.ts`
- `packages/gltf-static/c3runtime/gltf/GltfModel.ts`
- `packages/gltf-static/c3runtime/gltf/TransformWorkerPool.ts`

**Step 1:** Run full build
```bash
npm run build:static
```
Expected: `gltf-bundle.js built successfully` with zero TypeScript errors.

**Step 2:** Verify no references to deleted symbols remain
```bash
grep -rn "queueStaticLighting\|LIGHTING_BATCH\|_instanceMatrixDirty\|_lastStaticLightingVersion\|setInstanceMatrix\|_applyLightingToAllMeshes\|_markTransformDirty\|modelMatrix" packages/gltf-static/c3runtime/
```
Expected: zero matches (or only comments/dead references that should be cleaned up).

**Step 3:** Commit if any final cleanup done
```bash
git add packages/gltf-static/
git commit -m "chore: final cleanup of dead transform/lighting code"
```

**Manual test checklist:**
- [ ] Static object lit by moving spotlight — spotlight updates every frame
- [ ] Animated object still animates correctly with lighting
- [ ] BakeLighting action freezes lighting
- [ ] UnbakeLighting action restores live lighting on next frame
- [ ] Frame skip still works (updates less frequently but uniformly)
