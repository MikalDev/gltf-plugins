// Import types only (not runtime values) for TypeScript checking
import type { GltfModel as GltfModelType } from "./gltf/GltfModel.js";
import type { GltfMesh as GltfMeshType } from "./gltf/GltfMesh.js";
import type { SharedWorkerPool as SharedWorkerPoolType, WorkerLightConfig } from "./gltf/TransformWorkerPool.js";
import type { AnimationController as AnimationControllerType } from "./gltf/AnimationController.js";
import type { mat4 as mat4Type, vec3 as vec3Type, quat as quatType } from "gl-matrix";
import type * as LightingType from "./gltf/Lighting.js";

// Augment globalThis with GltfBundle type
declare global {
	var GltfBundle: {
		GltfModel: typeof GltfModelType;
		GltfMesh: typeof GltfMeshType;
		SharedWorkerPool: typeof SharedWorkerPoolType;
		AnimationController: typeof AnimationControllerType;
		mat4: typeof mat4Type;
		vec3: typeof vec3Type;
		quat: typeof quatType;
		Lighting: typeof LightingType;
	};
	// Global debug flag for all glTF modules
	var gltfDebug: boolean;
}

// Initialize global debug flag (off by default)
globalThis.gltfDebug = false;

// Access bundle from globalThis (C3 worker compatible - no ES module import)
const { GltfModel, GltfMesh, SharedWorkerPool, AnimationController, mat4, vec3, quat, Lighting } = globalThis.GltfBundle;

const LOG_PREFIX = "[GltfStatic]";

function debugLog(...args: unknown[]): void {
	if (globalThis.gltfDebug) console.log(LOG_PREFIX, ...args);
}

function debugWarn(...args: unknown[]): void {
	if (globalThis.gltfDebug) console.warn(LOG_PREFIX, ...args);
}

function debugError(...args: unknown[]): void {
	// Always log errors
	console.error(LOG_PREFIX, ...args);
}

function modelLoadLog(...args: unknown[]): void {
	if (globalThis.gltfDebug) console.log(LOG_PREFIX, ...args);
}

function modelLoadWarn(...args: unknown[]): void {
	if (globalThis.gltfDebug) console.warn(LOG_PREFIX, ...args);
}

// Property indices (link properties are excluded from _getInitProperties)
// Only data properties are included: model-url, rotation-x, rotation-y, rotation-z, scale, use-built-in-model, built-in-model-type
const PROP_MODEL_URL = 0;
const PROP_MODEL_FILE = 1;
const PROP_ROTATION_X = 2;
const PROP_ROTATION_Y = 3;
const PROP_ROTATION_Z = 4;
const PROP_SCALE = 5;
const PROP_USE_BUILTIN = 6;
const PROP_BUILTIN_TYPE = 7;
const PROP_BBOX_SCALE = 8;
const PROP_CONVERT_AXES = 9;

// Reusable matrix/vector for transform calculations (avoid per-frame allocations)
const tempVec = vec3.create();

// Degrees to radians conversion factor
const DEG_TO_RAD = Math.PI / 180;

/** Intensity multiplier applied to a spotlight when all shadow rays detect occlusion. */
const SHADOW_OCCLUSION_FACTOR = 0.2;
/** Number of occlusion rays per light: center, top, bottom, left, right. */
const OCCLUSION_RAY_COUNT = 5;
const RAD_TO_DEG = 180 / Math.PI;

C3.Plugins.GltfStatic.Instance = class GltfStaticInstance extends ISDKWorldInstanceBase
{
	// Model state
	_modelUrl: string = "";
	_useBuiltinModel: boolean = false;
	_builtinModelType: number = 0; // 0 = cube, 1 = sphere
	_rotationX: number = 0;
	_rotationY: number = 0;
	_rotationZ: number = 0;
	_scaleX: number = 1;
	_scaleY: number = 1;
	_scaleZ: number = 1;
	_debug: boolean = false;

	// Quaternion rotation (x, y, z, w) - used internally, initialized from euler
	// This represents the 3D rotation (replaces rotationX/Y/Z when set directly)
	_rotationQuat: Float32Array = new Float32Array([0, 0, 0, 1]); // Identity quaternion

	// Instance TRS matrix for CPU-side vertex transformation
	_instanceMatrix: Float32Array = mat4.create() as unknown as Float32Array;

	// Cached TRS inputs from last transform push. NaN forces first push.
	_lastTickX: number = NaN;
	_lastTickY: number = NaN;
	_lastTickZ: number = NaN;
	_lastTickAngle: number = NaN;
	_lastTickScaleX: number = NaN;
	_lastTickScaleY: number = NaN;
	_lastTickScaleZ: number = NaN;
	_lastTickQuat: Float32Array = new Float32Array([NaN, NaN, NaN, NaN]);

	// glTF model
	_model: GltfModelType | null = null;
	_isLoading: boolean = false;

	// Animation controller (created when model has skinning data)
	_animationController: AnimationControllerType | null = null;
	_skinnedMeshIndices: number[] = [];  // Maps animation controller mesh index to model mesh index
	_morphSkinBuffers: Map<number, { positions: Float32Array; normals: Float32Array }> = new Map();  // Reusable buffers for morph+skin
	_pendingAnimation: string | null = null;  // Animation name requested before controller was ready
	_pendingAnimationIndex: number | null = null; // Animation index requested before controller was ready

	// Animation frame skip (performance optimization)
	_animationFrameSkip: number = 0;      // How many frames to skip (0 = update every frame)
	_frameCounter: number = 0;            // Current frame counter
	_accumulatedDt: number = 0;           // Accumulated delta time
	_frameOffset: number = 0;             // Stagger offset to spread instances across frames
	_frameSkipIncludesLighting: boolean = true;  // When true, lighting is also skipped on skipped frames
	_tickCount: number = 0;               // Counts processed ticks; draw suppressed until >= 10 to cover worker cold-start

	// Distance-based LOD for animation frame skip
	_distanceLodEnabled: boolean = false;  // When true, frame skip is calculated from camera distance
	_lodFullRateRadius: number = 500;      // No skip within this radius (always full update rate)
	_lodMaxSkipDistance: number = 2000;    // Maximum frame skip at this distance and beyond
	_lodMaxFrameSkip: number = 5;          // Maximum frame skip when at/beyond max distance

	// Physics integration
	_bboxScale: number = 1;                // Scale factor for bounding box (for physics shape sizing)

	// World-space AABB extents *relative to instance position* — post-scale,
	// post-rotation, post-bboxScale. Populated by _recomputeWorldExtents(),
	// consumed by _pushAabbToWorldInfo().
	_worldBBoxMin: [number, number, number] = [0, 0, 0];
	_worldBBoxMax: [number, number, number] = [0, 0, 0];

	// V2 SDK has no setOriginZ, so C3's bbox always spans [totalZ, totalZ+depth].
	// We compensate by shifting the raw z by _zCullShift (= lo[2]) so the back
	// face of the bbox lands on the true back of the model. The z/totalZ
	// accessor overrides hide this shift from user scripts.
	_zCullShift: number = 0;

	// glTF (Y-up, right-handed) → C3 (Y-down) axis conversion
	_convertAxes: boolean = false;


	// Per-light occlusion cache: stores intensity factor and per-ray tags/results.
	// 5 rays per light: center, top, bottom, left, right.
	_lightOcclusionCache: Map<number, { factor: number; rays: Array<{ tag: string; resultKey: string; hit: boolean }> }> = new Map();

	// Shadow ray count: 1 (center only, binary) or 5 (center + top/bottom/left/right, smooth penumbra)
	_shadowRayCount: number = 1;

	// Addon image texture applied to built-in models (one-shot flag to prevent double UV remap)
	_addonTextureApplied: boolean = false;

	// Texture (sprite-frame) animation state
	_texAnimPlaying: boolean = false;
	_texAnimFrame: number = 0;
	_texAnimSpeedScale: number = 1;
	_texAnimAccumulator: number = 0;
	_texAnimName: string = "Default";
	_texAnimForward: boolean = true;  // for ping-pong direction
	_texSourceInst: any = null;       // Sprite instance used as animation source

	// Cached Rapier3DPhysics behavior reference: undefined = not yet checked, null = absent.
	_cachedPhysBeh: unknown = undefined;

	// Static counter for generating stagger offsets
	static _instanceCounter: number = 0;

	constructor()
	{
		super();
		debugLog("Instance created");

		// Assign stagger offset from static counter (wraps automatically when used with modulo)
		this._frameOffset = GltfStaticInstance._instanceCounter++;

		// SDK v2: Initialize from properties in constructor
		const props = this._getInitProperties();
		if (props)
		{
			const modelFile = props[PROP_MODEL_FILE];
			const modelUrlLegacy = props[PROP_MODEL_URL] as string;
			this._modelUrl = (typeof modelFile === "string" && modelFile.length > 0) ? modelFile : modelUrlLegacy;
			this._rotationX = props[PROP_ROTATION_X] as number;
			this._rotationY = props[PROP_ROTATION_Y] as number;
			this._rotationZ = props[PROP_ROTATION_Z] as number;
			// Uniform scale property sets all axes
			const uniformScale = props[PROP_SCALE] as number;
			this._scaleX = uniformScale;
			this._scaleY = uniformScale;
			this._scaleZ = uniformScale;
			// Built-in model properties
			this._useBuiltinModel = props[PROP_USE_BUILTIN] as boolean;
			this._builtinModelType = props[PROP_BUILTIN_TYPE] as number;
			// Bounding box scale
			this._bboxScale = props[PROP_BBOX_SCALE] as number;
			// Axis conversion (glTF Y-up → C3 Y-down)
			this._convertAxes = props[PROP_CONVERT_AXES] as boolean;
			debugLog("Properties loaded:", {
				modelUrl: this._modelUrl,
				rotationX: this._rotationX,
				rotationY: this._rotationY,
				rotationZ: this._rotationZ,
				scale: { x: this._scaleX, y: this._scaleY, z: this._scaleZ },
				useBuiltinModel: this._useBuiltinModel,
				builtinModelType: this._builtinModelType
			});

			// Initialize quaternion from euler angles
			this._updateQuatFromEuler();

			// Auto-load model: built-in model takes priority over URL
			if (this._useBuiltinModel)
			{
				const builtinUrl = "builtin:" + (GltfStaticInstance.BUILTIN_NAMES[this._builtinModelType] ?? "cube");
				modelLoadLog("Auto-loading built-in model:", builtinUrl);
				this._loadModel(builtinUrl);
			}
			else if (this._modelUrl)
			{
				modelLoadLog("Auto-loading model from URL:", this._modelUrl);
				this._loadModel(this._modelUrl);
			}
		}
	}

	_release(): void
	{
		// Stop ticking
		this._setTicking(false);
		this._setTicking2(false);

		// Clean up animation controller
		this._animationController = null;
		this._texSourceInst = null;
		this._morphSkinBuffers.clear();

		// Clean up glTF model resources
		if (this._model)
		{
			this._model.release(this.runtime.renderer);
			this._model = null;
			modelLoadLog("Model resources released");
		}
	}

	/**
	 * Whether this instance renders to its own Z plane.
	 * Returns false to use standard layer Z ordering.
	 */
	_rendersToOwnZPlane(): boolean
	{
		return false;
	}

	/**
	 * Whether this instance must be pre-drawn before other instances.
	 * Returns false for standard draw order.
	 */
	_mustPreDraw(): boolean
	{
		return false;
	}

	/**
	 * Build instance TRS matrix: T(position) * R * S * T(-localCenter)
	 * Same as _buildModelViewMatrix but WITHOUT C3's camera transform.
	 * Used for CPU-side vertex transformation.
	 */
	_buildInstanceMatrix(): Float32Array
	{
		// KISS: Early return if no model - don't crash on null dereference
		if (!this._model)
		{
			return this._instanceMatrix;
		}

		mat4.identity(this._instanceMatrix);

		// 1. T(position): translate to instance world position
		vec3.set(tempVec, this.x, this.y, this.totalZ);
		mat4.translate(this._instanceMatrix, this._instanceMatrix, tempVec);

		// 2. R: apply C3 angle (Z rotation) first, then quaternion rotation
		if (this.angle !== 0)
		{
			mat4.rotateZ(this._instanceMatrix, this._instanceMatrix, this.angle);
		}

		// Apply quaternion rotation
		const rotMat = mat4.create();
		mat4.fromQuat(rotMat, this._rotationQuat);
		mat4.multiply(this._instanceMatrix, this._instanceMatrix, rotMat);

		// 3. S: scale
		vec3.set(tempVec, this._scaleX, this._scaleY, this._scaleZ);
		mat4.scale(this._instanceMatrix, this._instanceMatrix, tempVec);

		// 4. M_axis: glTF (Y-up) → C3 (Y-down). Skipped for built-ins (already in C3 space).
		if (this._shouldConvertAxes()) {
			vec3.set(tempVec, 1, -1, 1);
			mat4.scale(this._instanceMatrix, this._instanceMatrix, tempVec);
		}

		// 5. T(-localCenter): shift model so its center is at origin
		const lc = this._model.localCenter;
		vec3.set(tempVec, -lc[0], -lc[1], -lc[2]);
		mat4.translate(this._instanceMatrix, this._instanceMatrix, tempVec);

		return this._instanceMatrix;
	}

	/** True when the instance should apply glTF→C3 axis conversion. Built-ins skip. */
	_shouldConvertAxes(): boolean
	{
		return this._convertAxes && !this._useBuiltinModel;
	}

	_transformFieldsChanged(): boolean
	{
		const q = this._rotationQuat, lq = this._lastTickQuat;
		return this.x !== this._lastTickX
			|| this.y !== this._lastTickY
			|| this.totalZ !== this._lastTickZ
			|| this.angle !== this._lastTickAngle
			|| this._scaleX !== this._lastTickScaleX
			|| this._scaleY !== this._lastTickScaleY
			|| this._scaleZ !== this._lastTickScaleZ
			|| q[0] !== lq[0] || q[1] !== lq[1] || q[2] !== lq[2] || q[3] !== lq[3];
	}

	_cacheTransformFields(): void
	{
		this._lastTickX = this.x;
		this._lastTickY = this.y;
		this._lastTickZ = this.totalZ;
		this._lastTickAngle = this.angle;
		this._lastTickScaleX = this._scaleX;
		this._lastTickScaleY = this._scaleY;
		this._lastTickScaleZ = this._scaleZ;
		const q = this._rotationQuat, lq = this._lastTickQuat;
		lq[0] = q[0]; lq[1] = q[1]; lq[2] = q[2]; lq[3] = q[3];
	}

	_pushTransformIfChanged(): void
	{
		if (!this._model?.isLoaded) return;
		if (!this._transformFieldsChanged()) return;
		this._buildInstanceMatrix();
		this._model.updateTransformSync(this._instanceMatrix);
		this._cacheTransformFields();
	}

	/**
	 * Pre-multiply instance TRS matrix into each bone matrix.
	 * This applies object position/rotation/scale to skinned vertices efficiently:
	 * - Instead of transforming M vertices by instanceMatrix after skinning
	 * - We multiply N bone matrices by instanceMatrix (N << M typically)
	 *
	 * Math: finalPos = instanceMatrix * Σ(weight_i * boneMatrix_i * bindPos)
	 *                = Σ(weight_i * (instanceMatrix * boneMatrix_i) * bindPos)
	 *
	 * @param boneMatrices Original bone matrices (16 floats per bone, flattened)
	 * @returns New array with instance matrix pre-multiplied into each bone
	 */
	_applyInstanceMatrixToBones(boneMatrices: Float32Array): Float32Array
	{
		const boneCount = boneMatrices.length / 16;
		const result = new Float32Array(boneMatrices.length);
		const boneMat = mat4.create();
		const outMat = mat4.create();

		for (let i = 0; i < boneCount; i++)
		{
			const offset = i * 16;
			// Copy bone matrix into temp (subarray can't be used directly with mat4.multiply output)
			for (let j = 0; j < 16; j++)
			{
				boneMat[j] = boneMatrices[offset + j];
			}
			// Multiply: instanceMatrix * boneMatrix
			mat4.multiply(outMat, this._instanceMatrix as unknown as Float32Array & number[], boneMat);
			// Store result
			result.set(outMat as unknown as Float32Array, offset);
		}

		return result;
	}

	/**
	 * Called once per frame when ticking is enabled.
	 * Updates animation and runs always-transform+lighting pass for static meshes.
	 * No dirty-check heuristics — every shouldUpdate frame runs the full pass.
	 */
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

		// Update per-light occlusion via physics raycast (reads last tick's results, fires new ones)
		this._updateLightOcclusion();

		// Advance animation time (only when playing)
		if (this._animationController?.isPlaying() && !this._animationController.isPaused())
		{
			this._animationController.update(this._accumulatedDt);
		}

		// Apply animated morph weights to meshes
		if (this._animationController?.morphWeightsDirty && this._model)
		{
			const morphStates = this._animationController.getMorphWeightStates();
			if (morphStates.length > 0)
			{
				const weights = morphStates[0].weights;
				for (const mesh of this._model.meshes)
				{
					if (mesh.hasMorphTargets)
					{
						mesh.setMorphWeights(weights);
					}
				}
			}
			this._animationController.clearMorphWeightsDirty();
		}

		// Advance texture (sprite-frame) animation using accumulated dt (frame-skip aware)
		if (this._texAnimPlaying && this._useBuiltinModel) {
			this._tickTextureAnimation(this._accumulatedDt);
		}

		this._accumulatedDt = 0;

		if (this._animationController && this._model)
		{
			// Update bone hierarchy if we have skinned meshes
			if (this._skinnedMeshIndices.length > 0)
			{
				this._model.updateJointNodes(this._animationController);
				this._model.updateStaticMeshTransforms(this._instanceMatrix, this._getCameraPosition());
				this._updateSkinnedMeshes();
			}

			// Update non-skinned morphed meshes (main thread — workers have stale positions)
			for (const mesh of this._model.meshes)
			{
				if (!mesh.isSkinned && mesh.hasMorphTargets)
				{
					mesh.applyMorphedTransform(this._instanceMatrix);
					mesh.applyLighting(null, false, this._getCameraPosition());
				}
			}
		}

		// Transform + light static meshes via workers (excludes skinned and morphed meshes)
		if (!this._isLightingBaked())
		{
			const lightConfig = this._buildLightConfig();
			this._model.forceStaticTransformAndLighting(this._instanceMatrix, lightConfig);
		}

		this._tickCount++;
		this.runtime.sdk.updateRender();
	}

	/**
	 * Fire raycasts to each shadow-enabled spotlight and read results from the previous tick.
	 * Uses the Rapier3DPhysics behavior attached to this instance.
	 * Supports 1 ray (center only, binary) or 5 rays (center + top/bottom/left/right, smooth penumbra).
	 * Tag format: "gltfspot_<lightId>_<rayIndex>" — behavior auto-appends "_<uid>" on read.
	 * Factor is linearly interpolated between 1.0 (no hits) and SHADOW_OCCLUSION_FACTOR (all hit).
	 */
	_updateLightOcclusion(): void
	{
		// Cache the behavior reference — behaviors are fixed after construction.
		if (this._cachedPhysBeh === undefined)
		{
			this._cachedPhysBeh = (this as any).behaviors?.Rapier3DPhysics ?? null;
		}
		const physBeh = this._cachedPhysBeh as any;
		if (!physBeh) return;

		const rayCount = this._shadowRayCount;
		const selfAny = this as any;
		const halfWidth = (selfAny.width ?? 0) * 0.5;
		const halfDepth = (selfAny.depth ?? 0) * 0.5;

		// Ray offsets: [dx, dy, dz] from object center
		// center, top (+Z), bottom (-Z), left (-X), right (+X)
		const offsets: [number, number, number][] = [
			[0, 0, 0],
			[0, 0, halfDepth],
			[0, 0, -halfDepth],
			[-halfWidth, 0, 0],
			[halfWidth, 0, 0],
		];

		const spotLights = Lighting.getAllSpotLights();
		for (const spot of spotLights)
		{
			if (!spot.enabled || !spot.shadow) continue;

			// Range cull: skip raycast if this instance is outside the light's range.
			if (spot.range > 0)
			{
				const dx = spot.position[0] - this.x;
				const dy = spot.position[1] - this.y;
				const dz = spot.position[2] - this.totalZ;
				if (dx * dx + dy * dy + dz * dz > spot.range * spot.range) continue;
			}

			// Build tags and result-keys lazily. Always allocate OCCLUSION_RAY_COUNT slots
			// so switching between 1 and 5 doesn't require cache rebuild.
			let entry = this._lightOcclusionCache.get(spot.id);
			if (!entry)
			{
				const rays = [];
				for (let i = 0; i < OCCLUSION_RAY_COUNT; i++)
				{
					const tag = `gltfspot_${spot.id}_${i}`;
					rays.push({ tag, resultKey: `${tag}_${this.uid}`, hit: false });
				}
				entry = { factor: 1.0, rays };
				this._lightOcclusionCache.set(spot.id, entry);
			}

			// Read results from previous tick and fire new rays (only up to rayCount).
			let hitCount = 0;
			for (let i = 0; i < rayCount; i++)
			{
				const ray = entry.rays[i];
				const result = physBeh.raycastResults?.get(ray.resultKey);
				if (result !== undefined)
				{
					ray.hit = result.hasHit;
				}
				if (ray.hit) hitCount++;

				const off = offsets[i];
				physBeh._RaycastFromSelf(
					ray.tag,
					spot.position[0], spot.position[1], spot.position[2],
					"0x8000",
					off[0], off[1], off[2]
				);
			}

			// Linear blend: 0 hits → 1.0, all hits → SHADOW_OCCLUSION_FACTOR
			entry.factor = 1.0 - (hitCount / rayCount) * (1.0 - SHADOW_OCCLUSION_FACTOR);
		}
	}

	/**
	 * Build lighting configuration for worker-based lighting calculation.
	 * Creates copies of all arrays to avoid race conditions with shared buffers.
	 */
	_buildLightConfig(): WorkerLightConfig
	{
		const lights = Lighting.getAllLights();
		const spotLights = Lighting.getAllSpotLights();
		const hemi = Lighting.getHemisphereLight();
		const specularConfig = Lighting.getSpecularConfig();

		// Copy all arrays to avoid race conditions - these are sent to workers
		// after flush(), but the source buffers could change between now and then
		const config: WorkerLightConfig = {
			ambient: new Float32Array(Lighting.getAmbientLight()),
			lights: lights.map(l => ({
				enabled: l.enabled,
				color: new Float32Array(l.color),
				intensity: l.intensity,
				direction: new Float32Array(l.direction),
				specularEnabled: l.specularEnabled
			})),
			spotLights: spotLights.map(l => ({
				enabled: l.enabled,
				color: new Float32Array(l.color),
				// Occlusion is resolved here (intensity scaled) so workers don't need the shadow flag.
				intensity: l.intensity * (l.shadow ? (this._lightOcclusionCache.get(l.id)?.factor ?? 1.0) : 1.0),
				position: new Float32Array(l.position),
				direction: new Float32Array(l.direction),
				innerConeAngle: l.innerConeAngle,
				outerConeAngle: l.outerConeAngle,
				falloffExponent: l.falloffExponent,
				range: l.range,
				specularEnabled: l.specularEnabled,
				type: l.type
			}))
		};

		// Add hemisphere light if enabled
		if (hemi.enabled) {
			config.hemisphere = {
				enabled: true,
				skyColor: new Float32Array(hemi.skyColor),
				groundColor: new Float32Array(hemi.groundColor),
				intensity: hemi.intensity
			};
		}

		// Add specular config and camera position if specular intensity > 0
		if (specularConfig.intensity > 0 || specularConfig.debugBlue) {
			config.specular = {
				shininess: specularConfig.shininess,
				intensity: specularConfig.intensity,
				debugBlue: specularConfig.debugBlue
			};
			config.cameraPosition = this._getCameraPosition();

			// Store camera for debug function
			Lighting.setDebugCamera(config.cameraPosition);
		}

		return config;
	}

	/**
	 * Get camera world position from C3's 3D Camera object.
	 */
	_getCameraPosition(): Float32Array {
		try {
			// Get 3D Camera from C3 runtime objects (single global plugin, no instances)
			const camera = (this.runtime as any).objects?.["3DCamera"];

			if (camera) {
				const camPos = new Float32Array(camera.getCameraPosition());
				Lighting.setDebugCamera(camPos);
				return camPos;
			}

			// Fallback: use layout scroll position
			console.log("[Specular] No 3DCamera found, using fallback");
			const layout = this.runtime.layout;
			const camPos = new Float32Array([
				layout.scrollX,
				layout.scrollY,
				500  // Default Z
			]);
			Lighting.setDebugCamera(camPos);
			return camPos;
		} catch (e) {
			console.error("[Specular] Error getting camera position:", e);
			return new Float32Array([0, 0, 500]);
		}
	}

	/**
	 * Push skinned positions from animation controller to mesh GPU buffers.
	 * Uses worker-based skinning when available, falls back to main thread.
	 * Meshes with active morph targets always use main-thread skinning
	 * because morph deltas must be applied before skinning (in bind space)
	 * and workers only have the original (non-morphed) positions.
	 */
	_updateSkinnedMeshes(): void
	{
		if (!this._animationController || !this._model) return;

		const meshes = this._model.meshes;
		if (!meshes) return;

		// Check if any skinned mesh has active morph targets
		let hasActiveMorphTargets = false;
		for (let i = 0; i < this._animationController.getMeshCount(); i++)
		{
			const mesh = meshes[this._skinnedMeshIndices[i]];
			if (mesh?.hasMorphTargets)
			{
				hasActiveMorphTargets = true;
				break;
			}
		}

		// Use worker skinning if available AND no morph targets are active.
		// Workers hold a copy of original positions and can't incorporate morph deltas,
		// so we fall back to main-thread skinning when morph targets are present.
		if (this._model.hasWorkerSkinning && !hasActiveMorphTargets)
		{
			const lightConfig = this._buildLightConfig();
			// Pre-multiply instance TRS matrix into bone matrices for efficiency
			// This applies object position/rotation/scale to skinned vertices
			const boneMatrices = this._animationController.getBoneMatrices();
			const transformedBoneMatrices = this._applyInstanceMatrixToBones(boneMatrices);
			this._model.queueSkinning(transformedBoneMatrices, lightConfig);
			return;
		}

		// Main thread skinning (also used as fallback when morph targets are active)
		const boneMatrices = this._animationController.getBoneMatrices();

		for (let i = 0; i < this._animationController.getMeshCount(); i++)
		{
			const meshIndex = this._skinnedMeshIndices[i];
			const mesh = meshes[meshIndex];
			if (!mesh) continue;

			if (mesh.hasMorphTargets)
			{
				// Morph + skin on main thread: apply morph deltas first, then skin
				const morphedPositions = mesh.getMorphedPositions();
				const morphedNormals = mesh.getMorphedNormals();
				if (morphedPositions)
				{
					const skinned = this._skinPositions(morphedPositions, mesh, boneMatrices);
					mesh.updateSkinnedPositions(skinned);
				}
				if (morphedNormals)
				{
					const skinnedN = this._skinNormals(morphedNormals, mesh, boneMatrices);
					mesh.updateSkinnedNormals(skinnedN);
					mesh.invalidateLighting();
				}
			}
			else
			{
				// Non-morphed: use AnimationController's pre-computed skinned data
				mesh.updateSkinnedPositions(this._animationController.getSkinnedPositions(i));

				const normals = this._animationController.getSkinnedNormals(i);
				if (normals)
				{
					mesh.updateSkinnedNormals(normals);
					mesh.invalidateLighting(); // Force recalc since normals changed
				}
			}
		}
	}

	/**
	 * Skin positions on the main thread using bone matrices.
	 * Used for meshes with morph targets where we need morphed positions as input.
	 */
	private _skinPositions(positions: Float32Array, mesh: GltfMeshType, boneMatrices: Float32Array): Float32Array
	{
		const skinning = mesh.skinningData;
		if (!skinning) return positions;

		const vertexCount = positions.length / 3;

		// Reuse cached buffer to avoid per-frame allocation
		let cached = this._morphSkinBuffers.get(mesh.id);
		if (!cached || cached.positions.length !== positions.length)
		{
			const posBuffer = new Float32Array(positions.length);
			const normBuffer = new Float32Array(positions.length);
			cached = { positions: posBuffer, normals: normBuffer };
			this._morphSkinBuffers.set(mesh.id, cached);
		}
		const output = cached.positions;
		const joints = skinning.joints;
		const weights = skinning.weights;

		for (let v = 0; v < vertexCount; v++)
		{
			const posOffset = v * 3;
			const skinOffset = v * 4;

			const px = positions[posOffset];
			const py = positions[posOffset + 1];
			const pz = positions[posOffset + 2];

			let rx = 0, ry = 0, rz = 0;

			for (let j = 0; j < 4; j++)
			{
				const weight = weights[skinOffset + j];
				if (weight === 0) continue;

				const jointIdx = joints[skinOffset + j];
				const boneOffset = jointIdx * 16;
				const m = boneMatrices;

				const tx = m[boneOffset + 0] * px + m[boneOffset + 4] * py + m[boneOffset + 8] * pz + m[boneOffset + 12];
				const ty = m[boneOffset + 1] * px + m[boneOffset + 5] * py + m[boneOffset + 9] * pz + m[boneOffset + 13];
				const tz = m[boneOffset + 2] * px + m[boneOffset + 6] * py + m[boneOffset + 10] * pz + m[boneOffset + 14];

				rx += tx * weight;
				ry += ty * weight;
				rz += tz * weight;
			}

			output[posOffset] = rx;
			output[posOffset + 1] = ry;
			output[posOffset + 2] = rz;
		}

		return output;
	}

	/**
	 * Skin normals on the main thread using bone matrices.
	 * Used for meshes with morph targets where we need morphed normals as input.
	 */
	private _skinNormals(normals: Float32Array, mesh: GltfMeshType, boneMatrices: Float32Array): Float32Array
	{
		const skinning = mesh.skinningData;
		if (!skinning) return normals;

		const vertexCount = normals.length / 3;

		// Reuse cached buffer (allocated by _skinPositions for same mesh)
		let cached = this._morphSkinBuffers.get(mesh.id);
		if (!cached || cached.normals.length !== normals.length)
		{
			const posBuffer = new Float32Array(normals.length);
			const normBuffer = new Float32Array(normals.length);
			cached = { positions: posBuffer, normals: normBuffer };
			this._morphSkinBuffers.set(mesh.id, cached);
		}
		const output = cached.normals;
		const joints = skinning.joints;
		const weights = skinning.weights;

		for (let v = 0; v < vertexCount; v++)
		{
			const posOffset = v * 3;
			const skinOffset = v * 4;

			const nx = normals[posOffset];
			const ny = normals[posOffset + 1];
			const nz = normals[posOffset + 2];

			let rnx = 0, rny = 0, rnz = 0;

			for (let j = 0; j < 4; j++)
			{
				const weight = weights[skinOffset + j];
				if (weight === 0) continue;

				const jointIdx = joints[skinOffset + j];
				const boneOffset = jointIdx * 16;
				const m = boneMatrices;

				// Transform normal (rotation only, no translation — use upper-left 3x3)
				const tx = m[boneOffset + 0] * nx + m[boneOffset + 4] * ny + m[boneOffset + 8] * nz;
				const ty = m[boneOffset + 1] * nx + m[boneOffset + 5] * ny + m[boneOffset + 9] * nz;
				const tz = m[boneOffset + 2] * nx + m[boneOffset + 6] * ny + m[boneOffset + 10] * nz;

				rnx += tx * weight;
				rny += ty * weight;
				rnz += tz * weight;
			}

			output[posOffset] = rnx;
			output[posOffset + 1] = rny;
			output[posOffset + 2] = rnz;
		}

		return output;
	}

	/**
	 * Called after all _tick() calls. Flushes pending worker transforms.
	 */
	_tick2(): void
	{
		// Push instance transform after all behaviors/scripts have moved the instance this frame.
		// Runs every frame (not gated by frameskip) so position tracks Bullet/Tween/script motion
		// even when animation/skinning is frame-skipped. Cheap TRS-field compare gates the work.
		this._pushTransformIfChanged();

		SharedWorkerPool.flushIfPending();

		// Re-push bbox state every tick so changes to scale/rotation/bboxScale show up
		// (those callers also push directly, but tick is a safety net for anything that
		// mutates internal state without going through our setters).
		if (this._model?.isLoaded) {
			this._pushAabbToWorldInfo();
		}
	}

	_draw(renderer: IRenderer): void
	{
		if (this._model?.isLoaded && this._tickCount >= 10)
		{
			// Lazy fallback: apply addon texture if not yet applied (handles atlas load timing)
			if (this._useBuiltinModel && !this._addonTextureApplied) {
				this._applyAddonTexture();
			}

			// Vertices are already in world space (transformed by worker)
			// C3's camera matrix handles view/projection automatically
			this._model.draw(renderer, this.runtime.tickCount);
		}
		// else: not ready yet — render nothing
	}

	// Getters for model state
	_getRotationX(): number
	{
		return this._rotationX;
	}

	_getRotationY(): number
	{
		return this._rotationY;
	}

	_getRotationZ(): number
	{
		return this._rotationZ;
	}

	_setRotation(x: number, y: number, z: number): void
	{
		this._rotationX = x;
		this._rotationY = y;
		this._rotationZ = z;
		// Keep quaternion in sync
		this._updateQuatFromEuler();
		// Update C3 bounds (rotation affects world-space AABB)
		this._updateInstanceBounds();
	}

	// ========================================================================
	// Quaternion Rotation Methods
	// ========================================================================

	/**
	 * Update internal quaternion from current euler angles (rotationX/Y/Z).
	 * Called when euler angles change to keep quaternion in sync.
	 */
	_updateQuatFromEuler(): void
	{
		// Build quaternion matching editor rotation order: Rx * Ry * Rz
		// (Z applied first to vertex, then Y, then X)
		// This is intrinsic XYZ / extrinsic ZYX order.
		// Note: quat.fromEuler uses intrinsic ZYX which gives Rz*Ry*Rx — wrong order.
		const rx = this._rotationX * DEG_TO_RAD * 0.5;
		const ry = this._rotationY * DEG_TO_RAD * 0.5;
		const rz = this._rotationZ * DEG_TO_RAD * 0.5;

		const sx = Math.sin(rx), cx = Math.cos(rx);
		const sy = Math.sin(ry), cy = Math.cos(ry);
		const sz = Math.sin(rz), cz = Math.cos(rz);

		// Quaternion for Rx * Ry * Rz (intrinsic XYZ)
		this._rotationQuat[0] = sx * cy * cz + cx * sy * sz; // x
		this._rotationQuat[1] = cx * sy * cz - sx * cy * sz; // y
		this._rotationQuat[2] = cx * cy * sz + sx * sy * cz; // z
		this._rotationQuat[3] = cx * cy * cz - sx * sy * sz; // w
	}

	/**
	 * Set rotation using a quaternion (x, y, z, w).
	 * This directly sets the 3D rotation, bypassing euler angles.
	 * @param x Quaternion X component
	 * @param y Quaternion Y component
	 * @param z Quaternion Z component
	 * @param w Quaternion W component
	 */
	_setRotationQuaternion(x: number, y: number, z: number, w: number): void
	{
		this._rotationQuat[0] = x;
		this._rotationQuat[1] = y;
		this._rotationQuat[2] = z;
		this._rotationQuat[3] = w;

		// Normalize to ensure valid rotation
		quat.normalize(this._rotationQuat, this._rotationQuat);

		// Update euler angles to stay in sync (approximate, may have gimbal lock issues)
		this._updateEulerFromQuat();

		// Update C3 bounds (rotation affects world-space AABB)
		this._updateInstanceBounds();
	}

	/**
	 * Set rotation from a JSON string: {"x":0,"y":0,"z":0,"w":1}
	 */
	_setRotationQuaternionJson(json: string): void
	{
		try
		{
			const obj = JSON.parse(json);
			if (typeof obj.x === "number" && typeof obj.y === "number" &&
				typeof obj.z === "number" && typeof obj.w === "number")
			{
				this._setRotationQuaternion(obj.x, obj.y, obj.z, obj.w);
			}
		}
		catch (e)
		{
			debugWarn("Invalid quaternion JSON:", json);
		}
	}

	/**
	 * Get rotation quaternion as [x, y, z, w].
	 */
	_getRotationQuaternion(): [number, number, number, number]
	{
		return [
			this._rotationQuat[0],
			this._rotationQuat[1],
			this._rotationQuat[2],
			this._rotationQuat[3]
		];
	}

	/**
	 * Get rotation quaternion as JSON string.
	 */
	_getRotationQuaternionJson(): string
	{
		return JSON.stringify({
			x: this._rotationQuat[0],
			y: this._rotationQuat[1],
			z: this._rotationQuat[2],
			w: this._rotationQuat[3]
		});
	}

	/**
	 * Update euler angles from current quaternion.
	 * Called when quaternion is set directly to keep euler in sync.
	 * Note: Euler extraction can have gimbal lock issues.
	 */
	_updateEulerFromQuat(): void
	{
		// Extract euler angles from quaternion
		// gl-matrix doesn't have a direct quat-to-euler, so we convert via matrix
		const m = mat4.create();
		mat4.fromQuat(m, this._rotationQuat);

		// Extract euler angles (same formula as _extractBoneRotation)
		let rotX: number, rotY: number, rotZ: number;

		if (Math.abs(m[8]) < 0.99999)
		{
			rotY = Math.asin(-m[8]);
			rotX = Math.atan2(m[9], m[10]);
			rotZ = Math.atan2(m[4], m[0]);
		}
		else
		{
			rotY = m[8] < 0 ? Math.PI / 2 : -Math.PI / 2;
			rotX = Math.atan2(-m[6], m[5]);
			rotZ = 0;
		}

		this._rotationX = rotX * RAD_TO_DEG;
		this._rotationY = rotY * RAD_TO_DEG;
		this._rotationZ = rotZ * RAD_TO_DEG;
	}

	/**
	 * Get individual quaternion components for expressions.
	 */
	_getQuatX(): number { return this._rotationQuat[0]; }
	_getQuatY(): number { return this._rotationQuat[1]; }
	_getQuatZ(): number { return this._rotationQuat[2]; }
	_getQuatW(): number { return this._rotationQuat[3]; }

	// Scale getters - GPU data stays static, only transform matrix changes
	_getScaleX(): number
	{
		return this._scaleX;
	}

	_getScaleY(): number
	{
		return this._scaleY;
	}

	_getScaleZ(): number
	{
		return this._scaleZ;
	}

	// Set uniform scale (all axes)
	_setScale(scale: number): void
	{
		this._scaleX = scale;
		this._scaleY = scale;
		this._scaleZ = scale;

		// Update C3 bounds when scale changes
		this._updateInstanceBounds();
	}

	// Set non-uniform scale (per axis)
	_setScaleXYZ(x: number, y: number, z: number): void
	{
		this._scaleX = x;
		this._scaleY = y;
		this._scaleZ = z;

		// Update C3 bounds when Z scale changes
		this._updateInstanceBounds();
	}

	_isModelLoaded(): boolean
	{
		return this._model?.isLoaded ?? false;
	}

	// Axis conversion control methods
	_isConvertAxes(): boolean
	{
		return this._convertAxes;
	}

	_getConvertAxes(): number
	{
		return this._convertAxes ? 1 : 0;
	}

	_setConvertAxes(value: boolean): void
	{
		if (this._convertAxes === value) return;
		this._convertAxes = value;

		// Built-ins skip axis conversion entirely; nothing to update on the GPU side.
		// The instance matrix is rebuilt every frame, so M_axis change applies on next draw.
		if (this._useBuiltinModel) return;
		if (!this._model?.isLoaded) return;

		// Reverse triangle winding in place to match the new M_axis state.
		// (Toggling axis conversion alone would flip det of the transform; reversing
		// indices keeps front faces facing forward under back-face culling.)
		for (const mesh of this._model.meshes) {
			mesh.reverseTriangleWinding();
		}

		// Y-flip changes which corner of the model bbox lands where in world space,
		// so the AABB push must be recomputed.
		this._updateInstanceBounds();
	}

	// Worker control methods
	_setWorkerEnabled(enabled: boolean): void
	{
		if (this._model)
		{
			this._model.setWorkersEnabled(enabled);
		}
	}

	_isUsingWorkers(): boolean
	{
		return this._model?.useWorkers ?? false;
	}

	_getWorkerEnabled(): number
	{
		return this._isUsingWorkers() ? 1 : 0;
	}

	_getWorkerCount(): number
	{
		return this._model?.getWorkerCount() ?? 0;
	}

	_isUsingWorkerSkinning(): boolean
	{
		return this._model?.hasWorkerSkinning ?? false;
	}

	_getWorkerSkinningEnabled(): number
	{
		return this._isUsingWorkerSkinning() ? 1 : 0;
	}

	_getTotalVertices(): number
	{
		return this._model?.getStats().totalVertices ?? 0;
	}

	_getMeshCount(): number
	{
		return this._model?.getStats().meshCount ?? 0;
	}

	// ========================================================================
	// Mesh Visibility Methods
	// ========================================================================

	_setMeshVisible(name: string, visible: boolean): void
	{
		this._model?.setMeshVisibleByName(name, visible);
	}

	_showAllMeshes(): void
	{
		this._model?.showAllMeshes();
	}

	_hideAllMeshes(): void
	{
		this._model?.hideAllMeshes();
	}

	_isMeshVisible(name: string): boolean
	{
		return this._model?.getMeshVisibleByName(name) ?? false;
	}

	_setMeshVisibleByIndex(index: number, visible: boolean): void
	{
		this._model?.setMeshVisibleByIndex(index, visible);
	}

	_isMeshVisibleByIndex(index: number): boolean
	{
		return this._model?.getMeshVisibleByIndex(index) ?? false;
	}

	_getMeshNames(): string
	{
		const names = this._model?.getMeshNames() ?? [];
		return JSON.stringify(names);
	}

	_getMeshNameAt(index: number): string
	{
		const meshes = this._model?.meshes;
		if (!meshes || index < 0 || index >= meshes.length) return "";
		return meshes[index].name;
	}

	// ========================================================================
	// Built-in Model Methods
	// ========================================================================

	static readonly BUILTIN_NAMES = ["cube", "sphere", "capsule", "cylinder", "cone", "ramp", "plane"] as const;

	_isBuiltinEnabled(): boolean
	{
		return this._useBuiltinModel;
	}

	_setBuiltinEnabled(enabled: boolean): void
	{
		if (this._useBuiltinModel === enabled) return;
		this._useBuiltinModel = enabled;
		if (enabled)
		{
			const builtinUrl = "builtin:" + (GltfStaticInstance.BUILTIN_NAMES[this._builtinModelType] ?? "cube");
			this._forceLoadModel(builtinUrl);
		}
	}

	_setBuiltinModel(typeIndex: number): void
	{
		this._builtinModelType = typeIndex;
		this._useBuiltinModel = true;
		const builtinUrl = "builtin:" + (GltfStaticInstance.BUILTIN_NAMES[typeIndex] ?? "cube");
		this._forceLoadModel(builtinUrl);
	}

	/** Force a model load, cancelling any in-progress load. */
	_forceLoadModel(url: string): void
	{
		this._isLoading = false;
		this._modelUrl = "";
		this._loadModel(url);
	}

	_getBuiltinModelType(): string
	{
		if (!this._useBuiltinModel) return "";
		return GltfStaticInstance.BUILTIN_NAMES[this._builtinModelType] ?? "";
	}

	// ========================================================================
	// Lighting Baking Methods
	// ========================================================================

	_bakeLighting(): void
	{
		if (!this._model) return;
		for (const mesh of this._model.meshes)
		{
			if (mesh.hasNormals && !mesh.isSkinned)
			{
				mesh.bakeLighting();
			}
		}
	}

	_unbakeLighting(): void
	{
		if (!this._model) return;
		for (const mesh of this._model.meshes)
		{
			mesh.unbakeLighting();
		}
	}

	_refreshAndBakeLighting(): void
	{
		if (!this._model) return;
		for (const mesh of this._model.meshes)
		{
			if (mesh.hasNormals && !mesh.isSkinned)
			{
				mesh.bakeLighting();
			}
		}
	}

	_isLightingBaked(): boolean
	{
		if (!this._model) return false;
		return this._model.meshes.some(mesh => mesh.isBaked());
	}

	// ========================================================================
	// Animation Control Methods
	// ========================================================================

	/**
	 * Create animation controller after model loads (if model has skinning data).
	 */
	_createAnimationController(): void
	{
		if (!this._model || this._animationController) return;

		const meshes = this._model.meshes;
		if (!meshes || meshes.length === 0) return;

		const hasAnimations = this._model.animations.length > 0;
		const hasSkinning = this._model.hasSkinning;
		const hasMorphTargets = meshes.some(m => m.hasMorphTargets);

		// Create the controller if the model has any animatable feature.
		// "skin, no clips" still needs it so bind-pose bone matrices reach the worker;
		// without it, skinned meshes fall through the static-mesh path which excludes them.
		if (!hasAnimations && !hasSkinning && !hasMorphTargets)
		{
			modelLoadLog("Model has no animations, skinning, or morph targets; skipping animation controller");
			return;
		}

		const skins = this._model.skins;

		// Build mesh data for animation controller and track skinned mesh indices
		const animMeshes: { originalPositions: Float32Array; originalNormals?: Float32Array | null; skinningData: any }[] = [];
		this._skinnedMeshIndices = [];
		this._morphSkinBuffers.clear();
		for (let i = 0; i < meshes.length; i++)
		{
			const mesh = meshes[i];
			if (mesh.isSkinned && mesh.originalPositions && mesh.skinningData)
			{
				this._skinnedMeshIndices.push(i);
				animMeshes.push({
					originalPositions: mesh.originalPositions,
					originalNormals: mesh.originalNormals,
					skinningData: mesh.skinningData
				});
			}
		}

		// For morph-only models (no skinning), we still need the animation controller
		// Use an empty skin with zero joints
		const skinData = skins.length > 0 ? skins[0] : {
			name: "",
			joints: [],
			inverseBindMatrices: new Float32Array(0),
			nodeToJointIndex: new Map()
		};

		if (animMeshes.length === 0 && !hasMorphTargets)
		{
			modelLoadLog("No skinned meshes or morph targets found, skipping animation controller");
			return;
		}

		try
		{
			this._animationController = new AnimationController({
				skinData,
				animations: [...this._model.animations],
				meshes: animMeshes
			});

			// Force enable worker skinning when we have skinned meshes
			if (animMeshes.length > 0)
			{
				this._animationController.useWorkerSkinning = true;
				console.log("[GltfStatic] Worker skinning FORCED enabled for animation controller");
			}

			// Set up onComplete callback to trigger condition
			this._animationController.onComplete = () =>
			{
				this._trigger(C3.Plugins.GltfStatic.Cnds.OnAnimationFinished);
			};

			modelLoadLog(`Animation controller created with ${this._model.animations.length} animations, ${animMeshes.length} skinned meshes`);

		// Apply any animation that was requested before the controller was ready
		if (this._pendingAnimation !== null)
		{
			this._animationController.play(this._pendingAnimation);
			this._pendingAnimation = null;
		}
		else if (this._pendingAnimationIndex !== null)
		{
			this._animationController.playByIndex(this._pendingAnimationIndex);
			this._pendingAnimationIndex = null;
		}
		}
		catch (err)
		{
			debugError("Failed to create animation controller:", err);
			this._animationController = null;
		}
	}

	_playAnimation(name: string): void
	{
		if (!this._animationController)
		{
			this._pendingAnimation = name;
			return;
		}
		this._animationController.play(name);
	}

	_playAnimationByIndex(index: number): void
	{
		if (!this._animationController)
		{
			this._pendingAnimationIndex = index;
			return;
		}
		this._animationController.playByIndex(index);
	}

	_stopAnimation(): void
	{
		this._animationController?.stop();
	}

	_pauseAnimation(): void
	{
		this._animationController?.pause();
	}

	_resumeAnimation(): void
	{
		this._animationController?.resume();
	}

	_setAnimationTime(time: number): void
	{
		this._animationController?.setTime(time);
	}

	_setAnimationSpeed(speed: number): void
	{
		if (this._animationController)
		{
			this._animationController.playbackRate = speed;
		}
	}

	_setAnimationLoop(loop: boolean): void
	{
		if (this._animationController)
		{
			this._animationController.loop = loop;
		}
	}

	_isAnimationPlaying(): boolean
	{
		return this._animationController?.isPlaying() ?? false;
	}

	_isAnimationPaused(): boolean
	{
		return this._animationController?.isPaused() ?? false;
	}

	_getAnimationTime(): number
	{
		return this._animationController?.getTime() ?? 0;
	}

	_getAnimationDuration(): number
	{
		return this._animationController?.getDuration() ?? 0;
	}

	_getAnimationName(): string
	{
		return this._animationController?.getCurrentAnimation() ?? "";
	}

	_getAnimationCount(): number
	{
		return this._animationController?.getAnimationCount() ?? this._model?.animations.length ?? 0;
	}

	_getAnimationNameAt(index: number): string
	{
		if (this._animationController)
		{
			return this._animationController.getAnimationNameAt(index);
		}
		// Fallback to model data if no controller yet
		const anims = this._model?.animations;
		if (anims && index >= 0 && index < anims.length)
		{
			return anims[index].name;
		}
		return "";
	}

	_getAnimationSpeed(): number
	{
		return this._animationController?.playbackRate ?? 1;
	}

	_getAnimationProgress(): number
	{
		return this._animationController?.getNormalizedTime() ?? 0;
	}

	_hasAnimation(name: string): boolean
	{
		if (this._animationController)
		{
			return this._animationController.hasAnimation(name);
		}
		// Fallback to model data
		const anims = this._model?.animations;
		if (anims)
		{
			return anims.some(a => a.name === name);
		}
		return false;
	}

	_getAnimationNamesJson(): string
	{
		const names = this._animationController?.getAnimationNames() ??
			this._model?.animations.map(a => a.name) ?? [];
		return JSON.stringify(names);
	}

	_blendToAnimation(name: string, duration: number, startTime: number): void
	{
		if (!this._animationController)
		{
			debugWarn("No animation controller - model may not have animations");
			return;
		}
		this._animationController.blendTo(name, duration, startTime);
	}

	_isBlending(): boolean
	{
		return this._animationController?.isBlending() ?? false;
	}

	_getBlendProgress(): number
	{
		return this._animationController?.getBlendProgress() ?? 0;
	}

	// ========================================================================
	// Animation Frame Skip Methods (Performance Optimization)
	// ========================================================================

	/**
	 * Set the number of frames to skip between animation updates.
	 * 0 = update every frame, 1 = update every 2nd frame, etc.
	 * Animation speed is maintained by accumulating delta time.
	 * @param skip Number of frames to skip (0 or greater)
	 */
	_setAnimationFrameSkip(skip: number): void
	{
		this._animationFrameSkip = Math.max(0, Math.floor(skip));
		// Reset counters when changing frame skip to avoid stale state
		this._frameCounter = 0;
		this._accumulatedDt = 0;
	}

	// ========================================================================
	// Distance-Based LOD Methods
	// ========================================================================

	/**
	 * Calculate frame skip based on distance to camera.
	 * Uses linear interpolation between near (skip=0) and far (skip=max).
	 */
	_calculateDistanceFrameSkip(): number
	{
		const camPos = this._getCameraPosition();
		const dx = this.x - camPos[0];
		const dy = this.y - camPos[1];
		const dz = this.totalZ - camPos[2];
		const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

		if (distance <= this._lodFullRateRadius) return 0;
		if (distance >= this._lodMaxSkipDistance) return this._lodMaxFrameSkip;

		// Linear interpolation
		const t = (distance - this._lodFullRateRadius) / (this._lodMaxSkipDistance - this._lodFullRateRadius);
		return Math.floor(t * this._lodMaxFrameSkip);
	}

	/**
	 * Enable or disable distance-based LOD for animation frame skip.
	 */
	_setDistanceLodEnabled(enabled: boolean): void
	{
		this._distanceLodEnabled = enabled;
	}

	/**
	 * Check if distance-based LOD is enabled.
	 */
	_getDistanceLodEnabled(): boolean
	{
		return this._distanceLodEnabled;
	}

	/**
	 * Configure distance LOD thresholds.
	 * @param fullRateRadius Radius within which full update rate is used (no skip)
	 * @param maxSkipDistance Distance at which maximum frame skip is used
	 * @param maxSkip Maximum frame skip value at max distance
	 */
	_setDistanceLodThresholds(fullRateRadius: number, maxSkipDistance: number, maxSkip: number): void
	{
		this._lodFullRateRadius = Math.max(0, fullRateRadius);
		this._lodMaxSkipDistance = Math.max(this._lodFullRateRadius + 1, maxSkipDistance);
		this._lodMaxFrameSkip = Math.max(0, Math.floor(maxSkip));
	}

	/**
	 * Get the current effective frame skip (accounting for distance LOD if enabled).
	 */
	_getEffectiveFrameSkip(): number
	{
		return this._distanceLodEnabled
			? this._calculateDistanceFrameSkip()
			: this._animationFrameSkip;
	}

	/**
	 * Get the current animation frame skip value.
	 * @returns Number of frames being skipped (0 = every frame)
	 */
	_getAnimationFrameSkip(): number
	{
		return this._animationFrameSkip;
	}

	/**
	 * Set whether lighting updates are also skipped on skipped frames.
	 * When enabled (default), skipped frames render from existing GPU buffers
	 * without recalculating lighting, providing maximum performance benefit.
	 * @param enabled Whether to include lighting in frame skip
	 */
	_setFrameSkipLighting(enabled: boolean): void
	{
		this._frameSkipIncludesLighting = enabled;
	}

	/**
	 * Get whether lighting updates are skipped on skipped frames.
	 * @returns true if lighting is included in frame skip (default)
	 */
	_getFrameSkipLighting(): boolean
	{
		return this._frameSkipIncludesLighting;
	}

	async _loadModel(url: string): Promise<void>
	{
		// Prevent concurrent loads
		if (this._isLoading)
		{
			modelLoadWarn("Load already in progress, ignoring request for:", url);
			return;
		}

		// Skip if same URL is already loaded
		if (this._model?.isLoaded && this._modelUrl === url)
		{
			modelLoadLog("Model already loaded, skipping:", url);
			return;
		}

		modelLoadLog("Starting model load:", url);
		const loadStart = performance.now();

		this._modelUrl = url;
		this._isLoading = true;
		this._addonTextureApplied = false;

		// Release existing model
		if (this._model)
		{
			modelLoadLog("Releasing previous model");
			this._model.release(this.runtime.renderer);
			this._model = null;
		}

		try
		{
			this._model = new GltfModel();
			// Built-in models are hand-authored in C3 space; never reverse winding for them.
			const isBuiltin = url.startsWith("builtin:");
			await this._model.load(this.runtime.renderer, url, {
				convertAxes: isBuiltin ? false : this._convertAxes
			});

			const loadTime = performance.now() - loadStart;
			const stats = this._model.getStats();

			modelLoadLog(`Model loaded successfully in ${loadTime.toFixed(0)}ms:`, {
				url,
				...stats
			});

			// Start ticking to process transforms each frame
			if (!this._isTicking())
			{
				this._setTicking(true);
			}
			// Enable tick2 to flush worker transforms after all tick() calls
			if (!this._isTicking2())
			{
				this._setTicking2(true);
			}

			// Create animation controller if model has skinning/animation data
			this._createAnimationController();

			// Apply addon image texture to built-in models
			if (this._useBuiltinModel) {
				this._applyAddonTexture();
			}

			// Update C3 instance bounds from model bounding box for proper 3D culling
			this._updateInstanceBounds();

			// Trigger "On Loaded" condition
			this._trigger(C3.Plugins.GltfStatic.Cnds.OnLoaded);
		}
		catch (err)
		{
			const loadTime = performance.now() - loadStart;
			debugError(`Failed to load model after ${loadTime.toFixed(0)}ms:`, url, err);
			this._model = null;

			// Trigger "On Load Error" condition
			this._trigger(C3.Plugins.GltfStatic.Cnds.OnLoadError);
		}
		finally
		{
			this._isLoading = false;
		}
	}

	/**
	 * Apply the addon's image texture to built-in models.
	 * C3 packs images into atlas sprite sheets, so UVs are remapped to the atlas sub-rect.
	 */
	_applyAddonTexture(): void {
		if (!this._model) return;
		const imageInfo = (this.objectType as any).getImageInfo();
		if (!imageInfo) return;
		const texture = imageInfo.getTexture(this.runtime.renderer);
		if (!texture) return;
		const texRect = imageInfo.getTexRect();
		this._model.applyExternalTexture(texture, texRect);
		this._addonTextureApplied = true;
	}

	// ========================================================================
	// Lighting Control Methods
	// ========================================================================

	/**
	 * Create a directional light (direction TO the light source).
	 * @returns Light ID
	 */
	_createDirectionalLight(dirX: number, dirY: number, dirZ: number): number
	{
		return Lighting.createDirectionalLight(dirX, dirY, dirZ);
	}

	/**
	 * Enable or disable a light.
	 */
	_setLightEnabled(id: number, enabled: boolean): void
	{
		Lighting.setLightEnabled(id, enabled);
	}

	/**
	 * Check if a light is enabled.
	 */
	_isLightEnabled(id: number): boolean
	{
		return Lighting.isLightEnabled(id);
	}

	/**
	 * Set light color (RGB 0-1).
	 */
	_setLightColor(id: number, r: number, g: number, b: number): void
	{
		Lighting.setLightColor(id, r, g, b);
	}

	/**
	 * Set light intensity.
	 */
	_setLightIntensity(id: number, intensity: number): void
	{
		Lighting.setLightIntensity(id, intensity);
	}

	/**
	 * Set light direction (TO the light, will be normalized).
	 */
	_setLightDirection(id: number, x: number, y: number, z: number): void
	{
		Lighting.setLightDirection(id, x, y, z);
	}

	/**
	 * Remove a light by ID.
	 */
	_removeLight(id: number): boolean
	{
		return Lighting.removeLight(id);
	}

	/**
	 * Remove all lights.
	 */
	_removeAllLights(): void
	{
		Lighting.removeAllLights();
	}

	/**
	 * Set ambient light color (RGB 0-1).
	 */
	_setAmbientLight(r: number, g: number, b: number): void
	{
		Lighting.setAmbientLight(r, g, b);
	}

	/**
	 * Get number of lights.
	 */
	_getLightCount(): number
	{
		return Lighting.getLightCount();
	}

	/**
	 * Check if any lights are enabled.
	 */
	_hasEnabledLights(): boolean
	{
		return Lighting.hasEnabledLights();
	}

	// ========================================================================
	// Spotlight Control Methods
	// ========================================================================

	/**
	 * Create a spotlight.
	 * @param posX Position X
	 * @param posY Position Y
	 * @param posZ Position Z
	 * @param dirX Direction X (cone axis)
	 * @param dirY Direction Y
	 * @param dirZ Direction Z
	 * @param innerAngle Inner cone angle in degrees
	 * @param outerAngle Outer cone angle in degrees
	 * @returns Light ID
	 */
	_createSpotLight(posX: number, posY: number, posZ: number, dirX: number, dirY: number, dirZ: number, innerAngle: number, outerAngle: number): number
	{
		return Lighting.createSpotLight(posX, posY, posZ, dirX, dirY, dirZ, innerAngle, outerAngle);
	}

	/**
	 * Set spotlight position.
	 */
	_setSpotLightPosition(id: number, x: number, y: number, z: number): void
	{
		Lighting.setSpotLightPosition(id, x, y, z);
	}

	/**
	 * Set spotlight direction (cone axis).
	 */
	_setSpotLightDirection(id: number, x: number, y: number, z: number): void
	{
		Lighting.setSpotLightDirection(id, x, y, z);
	}

	/**
	 * Set spotlight cone angles (in degrees).
	 */
	_setSpotLightConeAngles(id: number, innerAngle: number, outerAngle: number): void
	{
		Lighting.setSpotLightConeAngles(id, innerAngle, outerAngle);
	}

	/**
	 * Set spotlight edge falloff exponent.
	 */
	_setSpotLightFalloff(id: number, exponent: number): void
	{
		Lighting.setSpotLightFalloff(id, exponent);
	}

	/**
	 * Set spotlight range (0 = infinite).
	 */
	_setSpotLightRange(id: number, range: number): void
	{
		Lighting.setSpotLightRange(id, range);
	}

	/**
	 * Enable or disable a spotlight.
	 */
	_setSpotLightEnabled(id: number, enabled: boolean): void
	{
		Lighting.setSpotLightEnabled(id, enabled);
	}

	/**
	 * Set spotlight color (RGB 0-1).
	 */
	_setSpotLightColor(id: number, r: number, g: number, b: number): void
	{
		Lighting.setSpotLightColor(id, r, g, b);
	}

	/**
	 * Set spotlight intensity.
	 */
	_setSpotLightIntensity(id: number, intensity: number): void
	{
		Lighting.setSpotLightIntensity(id, intensity);
	}

	/**
	 * Remove a spotlight by ID.
	 */
	_removeSpotLight(id: number): boolean
	{
		return Lighting.removeSpotLight(id);
	}

	/**
	 * Remove all spotlights.
	 */
	_removeAllSpotLights(): void
	{
		Lighting.removeAllSpotLights();
	}

	/**
	 * Get number of spotlights.
	 */
	_getSpotLightCount(): number
	{
		return Lighting.getSpotLightCount();
	}

	/**
	 * Check if any spotlights are enabled.
	 */
	_hasEnabledSpotLights(): boolean
	{
		return Lighting.hasEnabledSpotLights();
	}

	// ========================================================================
	// Hemisphere Light Methods
	// ========================================================================

	/**
	 * Enable or disable hemisphere lighting.
	 */
	_setHemisphereLightEnabled(enabled: boolean): void
	{
		Lighting.setHemisphereLightEnabled(enabled);
	}

	/**
	 * Check if hemisphere lighting is enabled.
	 */
	_isHemisphereLightEnabled(): boolean
	{
		return Lighting.isHemisphereLightEnabled();
	}

	/**
	 * Set hemisphere light sky color (RGB 0-1).
	 */
	_setHemisphereLightSkyColor(r: number, g: number, b: number): void
	{
		Lighting.setHemisphereLightSkyColor(r, g, b);
	}

	/**
	 * Set hemisphere light ground color (RGB 0-1).
	 */
	_setHemisphereLightGroundColor(r: number, g: number, b: number): void
	{
		Lighting.setHemisphereLightGroundColor(r, g, b);
	}

	/**
	 * Set hemisphere light intensity.
	 */
	_setHemisphereLightIntensity(intensity: number): void
	{
		Lighting.setHemisphereLightIntensity(intensity);
	}

	/**
	 * Get hemisphere light intensity.
	 */
	_getHemisphereLightIntensity(): number
	{
		return Lighting.getHemisphereLight().intensity;
	}

	/**
	 * Get hemisphere light sky color as [r, g, b].
	 */
	_getHemisphereLightSkyColor(): [number, number, number]
	{
		const sky = Lighting.getHemisphereLight().skyColor;
		return [sky[0], sky[1], sky[2]];
	}

	/**
	 * Get hemisphere light ground color as [r, g, b].
	 */
	_getHemisphereLightGroundColor(): [number, number, number]
	{
		const ground = Lighting.getHemisphereLight().groundColor;
		return [ground[0], ground[1], ground[2]];
	}

	// ========================================================================
	// Physics Integration (direct property access)
	// ========================================================================

	/**
	 * Quaternion setter for physics integration.
	 * Allows physics behavior to set rotation directly: inst.quaternion = {x, y, z, w}
	 */
	set quaternion(q: { x: number; y: number; z: number; w: number })
	{
		this._setRotationQuaternion(q.x, q.y, q.z, q.w);
	}

	/**
	 * Quaternion getter for physics integration.
	 */
	get quaternion(): { x: number; y: number; z: number; w: number }
	{
		return {
			x: this._rotationQuat[0],
			y: this._rotationQuat[1],
			z: this._rotationQuat[2],
			w: this._rotationQuat[3]
		};
	}

	/**
	 * Model loaded state for physics integration.
	 * Returns true when model is fully loaded and ready.
	 */
	get loaded(): boolean
	{
		return this._model?.isLoaded ?? false;
	}

	/**
	 * Bounding box minimum for physics integration.
	 * Returns [x, y, z] minimum bounds in WORLD SPACE (includes instance scale).
	 * Example: [-25, -50, -25] for a model centered at origin.
	 */
	get xMinBB(): [number, number, number]
	{
		const bbox = this._getBoundingBox();
		if (!bbox) return [0, 0, 0];

		// Apply instance scale to get world-space bounding box
		const worldMin: [number, number, number] = [
			bbox.min[0] * this._scaleX,
			bbox.min[1] * this._scaleY,
			bbox.min[2] * this._scaleZ
		];

		if (this._debug) {
			console.log("[GltfStatic Physics] xMinBB (world-space):", worldMin,
				"model-space:", bbox.min, "scale:", [this._scaleX, this._scaleY, this._scaleZ]);
		}

		return worldMin;
	}

	/**
	 * Bounding box maximum for physics integration.
	 * Returns [x, y, z] maximum bounds in WORLD SPACE (includes instance scale).
	 * Example: [25, 50, 25] for a model centered at origin.
	 */
	get xMaxBB(): [number, number, number]
	{
		const bbox = this._getBoundingBox();
		if (!bbox) return [0, 0, 0];

		// Apply instance scale to get world-space bounding box
		const worldMax: [number, number, number] = [
			bbox.max[0] * this._scaleX,
			bbox.max[1] * this._scaleY,
			bbox.max[2] * this._scaleZ
		];

		if (this._debug) {
			console.log("[GltfStatic Physics] xMaxBB (world-space):", worldMax,
				"model-space:", bbox.max, "scale:", [this._scaleX, this._scaleY, this._scaleZ]);
		}

		return worldMax;
	}

	/**
	 * Set the bounding box scale factor for physics shape sizing.
	 * @param scale Scale factor (1 = use actual bounding box size)
	 */
	_setBBoxScale(scale: number): void
	{
		this._bboxScale = scale;

		// Update C3 bounds when bbox scale changes
		this._updateInstanceBounds();
	}

	/**
	 * Get the bounding box scale factor.
	 */
	_getBBoxScale(): number
	{
		return this._bboxScale;
	}

	/**
	 * Recompute world-space AABB extents from the model bbox, scale, rotation, and bboxScale.
	 * Stores instance-relative results in _worldBBoxMin/Max. Does NOT push to C3.
	 */
	_recomputeWorldExtents(): void
	{
		if (!this._model?.isLoaded) return;

		const min = this._model.boundingBoxMin;
		const max = this._model.boundingBoxMax;

		const corners = [
			[min[0], min[1], min[2]],
			[min[0], min[1], max[2]],
			[min[0], max[1], min[2]],
			[min[0], max[1], max[2]],
			[max[0], min[1], min[2]],
			[max[0], min[1], max[2]],
			[max[0], max[1], min[2]],
			[max[0], max[1], max[2]]
		];

		let worldMinX = Infinity, worldMaxX = -Infinity;
		let worldMinY = Infinity, worldMaxY = -Infinity;
		let worldMinZ = Infinity, worldMaxZ = -Infinity;

		const qx = this._rotationQuat[0];
		const qy = this._rotationQuat[1];
		const qz = this._rotationQuat[2];
		const qw = this._rotationQuat[3];

		// Mirror the per-vertex transform in _buildInstanceMatrix: Rq * S * F * T(-lc) * v.
		// (Layout Z-angle Rz is intentionally omitted — gltf-static instances rarely use it.)
		const lc = this._model.localCenter;
		const flipY = this._shouldConvertAxes() ? -1 : 1;

		for (const corner of corners) {
			// T(-lc) then F (Y-flip when converting glTF Y-up → C3 Y-down)
			const cx = corner[0] - lc[0];
			const cy = (corner[1] - lc[1]) * flipY;
			const cz = corner[2] - lc[2];

			// S: per-axis scale
			const sx = cx * this._scaleX;
			const sy = cy * this._scaleY;
			const sz = cz * this._scaleZ;

			// Rotate by quaternion: v' = q * v * q^-1
			const ix = qw * sx + qy * sz - qz * sy;
			const iy = qw * sy + qz * sx - qx * sz;
			const iz = qw * sz + qx * sy - qy * sx;
			const iw = -qx * sx - qy * sy - qz * sz;

			const rx = ix * qw + iw * -qx + iy * -qz - iz * -qy;
			const ry = iy * qw + iw * -qy + iz * -qx - ix * -qz;
			const rz = iz * qw + iw * -qz + ix * -qy - iy * -qx;

			if (rx < worldMinX) worldMinX = rx;
			if (rx > worldMaxX) worldMaxX = rx;
			if (ry < worldMinY) worldMinY = ry;
			if (ry > worldMaxY) worldMaxY = ry;
			if (rz < worldMinZ) worldMinZ = rz;
			if (rz > worldMaxZ) worldMaxZ = rz;
		}

		const bs = this._bboxScale;
		this._worldBBoxMin[0] = worldMinX * bs;
		this._worldBBoxMin[1] = worldMinY * bs;
		this._worldBBoxMin[2] = worldMinZ * bs;
		this._worldBBoxMax[0] = worldMaxX * bs;
		this._worldBBoxMax[1] = worldMaxY * bs;
		this._worldBBoxMax[2] = worldMaxZ * bs;
	}

	// Hide the cull-shift from user scripts: public z/totalZ/getPosition3d
	// return the user-set value; setters re-apply the shift. Behaviors that
	// reach WorldInfo directly (bypassing the script interface) still see the
	// shifted raw value — fine, the shift is constant per tick.
	//
	// IWorldInstance's z/totalZ are declared as fields in the .d.ts but are real
	// accessors at runtime (verified via prototype probe). TS won't compile
	// `super.z` against a field, hence the ts-expect-error pragmas.
	// @ts-expect-error overriding inherited field-typed accessor
	get z(): number {
		// @ts-expect-error runtime accessor on proto chain
		return super.z - this._zCullShift;
	}
	set z(v: number) {
		// @ts-expect-error runtime accessor on proto chain
		super.z = v + this._zCullShift;
	}

	// @ts-expect-error overriding inherited field-typed accessor
	get totalZ(): number {
		// @ts-expect-error runtime accessor on proto chain
		return super.totalZ - this._zCullShift;
	}

	setPosition3d(x: number, y: number, z: number): void {
		super.setPosition3d(x, y, z + this._zCullShift);
	}

	getPosition3d(): Vec3Arr {
		const p = super.getPosition3d();
		return [p[0], p[1], p[2] - this._zCullShift];
	}

	/**
	 * Push the cached world AABB to C3 via public V2 SDK setters.
	 *
	 * X/Y: tight, rotation-aware via setSize3d + setOrigin.
	 * Z:   V2 has no setOriginZ, so C3 always uses [totalZ, totalZ+depth]. We
	 *      shift the raw z by lo[2] so the back face lines up with the true
	 *      model back. The z/totalZ accessor overrides hide this from user
	 *      scripts; the setter inside this method bypasses through the same
	 *      override and naturally writes the shifted raw value.
	 */
	_pushAabbToWorldInfo(): void
	{
		const self = this as any;
		const lo = this._worldBBoxMin, hi = this._worldBBoxMax;
		const w = hi[0] - lo[0];
		const h = hi[1] - lo[1];
		const d = hi[2] - lo[2];
		if (w <= 0 || h <= 0 || d <= 0) return;  // not loaded / degenerate

		self.setSize3d(w, h, d);
		self.setOrigin(-lo[0] / w, -lo[1] / h);

		const delta = lo[2] - this._zCullShift;
		if (delta !== 0) {
			self.z = self.z + delta;
			this._zCullShift = lo[2];
		}
	}

	/**
	 * Recompute extents and push to C3. Call on rotation/scale/bboxScale/model-load.
	 * Position-only changes don't need this — the per-tick push in _tick2 handles them.
	 */
	_updateInstanceBounds(): void
	{
		if (!this._model?.isLoaded) return;
		this._recomputeWorldExtents();
		this._pushAabbToWorldInfo();
	}

	/**
	 * Get the model-space bounding box dimensions (width, height, depth).
	 * These are the raw dimensions before any instance scale is applied.
	 * @returns [width, height, depth] or null if model not loaded
	 */
	_getBoundingBoxSize(): [number, number, number] | null
	{
		if (!this._model?.isLoaded) return null;

		const min = this._model.boundingBoxMin;
		const max = this._model.boundingBoxMax;

		return [
			(max[0] - min[0]) * this._bboxScale,
			(max[1] - min[1]) * this._bboxScale,
			(max[2] - min[2]) * this._bboxScale
		];
	}

	/**
	 * Get the world-space bounding box dimensions (with instance scale applied).
	 * @returns [width, height, depth] or null if model not loaded
	 */
	_getWorldBoundingBoxSize(): [number, number, number] | null
	{
		const size = this._getBoundingBoxSize();
		if (!size) return null;

		return [
			size[0] * this._scaleX,
			size[1] * this._scaleY,
			size[2] * this._scaleZ
		];
	}

/**
	 * Get the bounding box as min/max coordinates in model space.
	 * @returns { min: [x, y, z], max: [x, y, z] } or null if model not loaded
	 */
	_getBoundingBox(): { min: [number, number, number]; max: [number, number, number] } | null
	{
		if (!this._model?.isLoaded) return null;

		const min = this._model.boundingBoxMin;
		const max = this._model.boundingBoxMax;

		return {
			min: [min[0], min[1], min[2]],
			max: [max[0], max[1], max[2]]
		};
	}

	/**
	 * Get the model's half-extents (half of bounding box dimensions) for physics shape creation.
	 * This is the format typically used by Cannon.js for box shapes.
	 * @returns [halfWidth, halfHeight, halfDepth] in world space, or null if model not loaded
	 */
	_getHalfExtents(): [number, number, number] | null
	{
		const size = this._getWorldBoundingBoxSize();
		if (!size) return null;

		return [
			size[0] * 0.5,
			size[1] * 0.5,
			size[2] * 0.5
		];
	}

	// ========================================================================
	// Morph Target Methods
	// ========================================================================

	/**
	 * Set a morph target weight by index on all meshes that have morph targets.
	 * @param index The morph target index (0-based)
	 * @param weight The weight value (typically 0 to 1)
	 */
	_setMorphWeight(index: number, weight: number): void
	{
		if (!this._model) return;
		for (const mesh of this._model.meshes) {
			if (mesh.hasMorphTargets) {
				mesh.setMorphWeight(index, weight);
			}
		}
	}

	/**
	 * Check if any mesh in the model has morph targets.
	 */
	_hasMorphTargets(): boolean
	{
		if (!this._model) return false;
		return this._model.meshes.some(mesh => mesh.hasMorphTargets);
	}

	/**
	 * Get the number of morph targets from the first mesh that has them.
	 */
	_getMorphTargetCount(): number
	{
		if (!this._model) return 0;
		for (const mesh of this._model.meshes) {
			if (mesh.hasMorphTargets) return mesh.morphTargetCount;
		}
		return 0;
	}

	/**
	 * Get the morph target weight at the given index from the first mesh that has morph targets.
	 * @param index The morph target index (0-based)
	 */
	_getMorphWeight(index: number): number
	{
		if (!this._model) return 0;
		for (const mesh of this._model.meshes) {
			if (mesh.hasMorphTargets && mesh.morphWeights) {
				return (index >= 0 && index < mesh.morphWeights.length) ? mesh.morphWeights[index] : 0;
			}
		}
		return 0;
	}

	// ========================================================================
	// Bone Attachment Methods
	// ========================================================================

	/**
	 * Get world position of a bone/node by name.
	 * For skinned models: returns animated bone position
	 * For non-skinned models: returns static node position
	 * Includes instance TRS (position, rotation, scale).
	 *
	 * @param name Bone/node name
	 * @returns [x, y, z] world coordinates, or null if not found
	 */
	_getBonePosition(name: string): [number, number, number] | null
	{
		if (!this._model?.isLoaded) return null;

		// Try animated bone first (skinned model)
		if (this._animationController)
		{
			const jointIndex = this._animationController.getJointIndexByName(name);
			if (jointIndex >= 0)
			{
				const jointMatrix = this._animationController.getJointWorldMatrix(jointIndex);
				if (jointMatrix)
				{
					return this._transformBoneToWorld(jointMatrix);
				}
			}
		}

		// Fall back to static node transform (non-skinned)
		const nodeMatrix = this._model.getNodeWorldMatrix(name);
		if (nodeMatrix)
		{
			return this._transformBoneToWorld(nodeMatrix);
		}

		return null;
	}

	/**
	 * Transform a bone/node local matrix to world coordinates.
	 * Applies: objectTRS * boneMatrix * origin
	 */
	_transformBoneToWorld(boneMatrix: Float32Array): [number, number, number]
	{
		// Build object transform matrix (same as _buildModelViewMatrix but without camera MV)
		const objectMatrix = mat4.create();

		// 1. T(position)
		vec3.set(tempVec, this.x, this.y, this.totalZ);
		mat4.translate(objectMatrix, objectMatrix, tempVec);

		// 2. R: apply C3 angle first, then quaternion rotation
		if (this.angle !== 0)
		{
			mat4.rotateZ(objectMatrix, objectMatrix, this.angle);
		}

		// Apply quaternion rotation
		const rotMat = mat4.create();
		mat4.fromQuat(rotMat, this._rotationQuat);
		mat4.multiply(objectMatrix, objectMatrix, rotMat);

		// 3. S(scale)
		vec3.set(tempVec, this._scaleX, this._scaleY, this._scaleZ);
		mat4.scale(objectMatrix, objectMatrix, tempVec);

		// 4. M_axis: match the same Y-flip applied in _buildInstanceMatrix
		if (this._shouldConvertAxes()) {
			vec3.set(tempVec, 1, -1, 1);
			mat4.scale(objectMatrix, objectMatrix, tempVec);
		}

		// 5. T(-localCenter)
		const lc = this._model!.localCenter;
		vec3.set(tempVec, -lc[0], -lc[1], -lc[2]);
		mat4.translate(objectMatrix, objectMatrix, tempVec);

		// Combine: objectMatrix * boneMatrix
		const combined = mat4.create();
		mat4.multiply(combined, objectMatrix, boneMatrix);

		// Extract position (translation component)
		return [combined[12], combined[13], combined[14]];
	}

	/**
	 * Get world rotation of a bone/node by name.
	 * Returns euler angles in degrees.
	 * @param name Bone/node name
	 * @returns [rotX, rotY, rotZ] in degrees, or null if not found
	 */
	_getBoneRotation(name: string): [number, number, number] | null
	{
		if (!this._model?.isLoaded) return null;

		let boneMatrix: Float32Array | null = null;

		// Try animated bone first (skinned model)
		if (this._animationController)
		{
			const jointIndex = this._animationController.getJointIndexByName(name);
			if (jointIndex >= 0)
			{
				boneMatrix = this._animationController.getJointWorldMatrix(jointIndex);
			}
		}

		// Fall back to static node transform (non-skinned)
		if (!boneMatrix)
		{
			boneMatrix = this._model.getNodeWorldMatrix(name);
		}

		if (!boneMatrix) return null;

		return this._extractBoneRotation(boneMatrix);
	}

	/**
	 * Extract euler rotation from combined object+bone matrix.
	 * Applies object rotations, then extracts euler angles.
	 */
	_extractBoneRotation(boneMatrix: Float32Array): [number, number, number]
	{
		// Build object rotation matrix (position/scale don't affect rotation extraction)
		const objectMatrix = mat4.create();

		// Apply C3 angle first, then quaternion rotation
		if (this.angle !== 0)
		{
			mat4.rotateZ(objectMatrix, objectMatrix, this.angle);
		}

		// Apply quaternion rotation
		const rotMat = mat4.create();
		mat4.fromQuat(rotMat, this._rotationQuat);
		mat4.multiply(objectMatrix, objectMatrix, rotMat);

		// When axis conversion is on, the bone matrix is in glTF frame but our object
		// rotation operates in C3 frame (Rquat sits to the left of M_axis in the
		// instance matrix). Conjugate the bone matrix by F = scale(1,-1,1) to express
		// its rotation in C3 axes: R_C3 = F * R_glTF * F. F is involutory so det stays +1.
		let workingBone = boneMatrix;
		if (this._shouldConvertAxes())
		{
			workingBone = new Float32Array(boneMatrix);
			// F * M * F on a column-major mat4 negates these six entries (M[5] is in
			// row 1 AND col 1 so double-negated → unchanged).
			workingBone[1] = -workingBone[1];
			workingBone[4] = -workingBone[4];
			workingBone[6] = -workingBone[6];
			workingBone[7] = -workingBone[7];
			workingBone[9] = -workingBone[9];
			workingBone[13] = -workingBone[13];
		}

		// Combine: objectRotation * boneMatrix
		const combined = mat4.create();
		mat4.multiply(combined, objectMatrix, workingBone);

		// Extract euler angles from rotation matrix (XYZ order)
		// Using standard rotation matrix decomposition for column-major mat4
		const m = combined;
		let rotX: number, rotY: number, rotZ: number;

		// Check for gimbal lock (when |m[8]| ≈ 1, meaning Y rotation ≈ ±90°)
		if (Math.abs(m[8]) < 0.99999)
		{
			rotY = Math.asin(-m[8]);
			rotX = Math.atan2(m[9], m[10]);
			rotZ = Math.atan2(m[4], m[0]);
		}
		else
		{
			// Gimbal lock case
			rotY = m[8] < 0 ? Math.PI / 2 : -Math.PI / 2;
			rotX = Math.atan2(-m[6], m[5]);
			rotZ = 0;
		}

		// Convert to degrees
		return [
			rotX * RAD_TO_DEG,
			rotY * RAD_TO_DEG,
			rotZ * RAD_TO_DEG
		];
	}

	/**
	 * Get 2D angle (Z rotation) of bone for sprite alignment.
	 * This is the most common use case - rotating a 2D sprite to match bone.
	 * @param name Bone/node name
	 * @returns Z rotation in degrees, or 0 if not found
	 */
	_getBoneAngle(name: string): number
	{
		const rotation = this._getBoneRotation(name);
		return rotation ? rotation[2] : 0;
	}

	/**
	 * Get list of available bone/node names.
	 * Combines animated joints (skinned) and static nodes (non-skinned).
	 * @returns JSON array of names
	 */
	_getBoneNames(): string
	{
		const names = new Set<string>();

		// Source 1: Animated joint names from controller (skinned models with animation)
		if (this._animationController)
		{
			const jointNames = this._animationController.getJointNames();
			for (const name of jointNames)
			{
				names.add(name);
			}
		}
		// Source 2: Joint names directly from model skins (skinned models without controller)
		else if (this._model?.skins)
		{
			for (const skin of this._model.skins)
			{
				for (const joint of skin.joints)
				{
					names.add(joint.name);
				}
			}
		}

		// Source 3: All node names (includes generated names for unnamed nodes)
		if (this._model)
		{
			const nodeNames = this._model.getNodeNames();
			for (const name of nodeNames)
			{
				names.add(name);
			}
		}

		return JSON.stringify(Array.from(names));
	}

	/**
	 * Get bone count (joints for skinned, nodes for non-skinned).
	 */
	_getBoneCount(): number
	{
		if (this._animationController)
		{
			return this._animationController.getJointCount();
		}
		if (this._model)
		{
			return this._model.getNodeNames().length;
		}
		return 0;
	}

	/**
	 * Check if a bone/node exists by name.
	 * @param name Bone/node name
	 * @returns true if found
	 */
	_hasBone(name: string): boolean
	{
		// Check animated joints first
		if (this._animationController?.hasJoint(name))
		{
			return true;
		}

		// Check static nodes
		if (this._model?.hasNode(name))
		{
			return true;
		}

		return false;
	}

	// ========================================================================
	// Debug Control
	// ========================================================================

	/**
	 * Enable or disable debug logging for all glTF modules.
	 */
	_setDebug(enabled: boolean): void
	{
		this._debug = enabled;
		globalThis.gltfDebug = enabled;
		if (enabled)
		{
			console.log("[GltfStatic] Debug logging enabled");
		}
	}

	/**
	 * Check if debug logging is enabled.
	 */
	_getDebug(): boolean
	{
		return this._debug;
	}

	// ========================================================================
	// Debugger Properties (C3 Debugger Panel)
	// ========================================================================

	/**
	 * Return properties to show in the C3 debugger panel.
	 * Updates in real-time when the debugger is open.
	 */
	_getDebuggerProperties(): object[]
	{
		const props: object[] = [];

		// Frame Skip section
		props.push({
			title: "Frame Skip",
			properties: [
				{
					name: "Distance LOD Enabled",
					value: this._distanceLodEnabled
				},
				{
					name: "Manual Frame Skip",
					value: this._animationFrameSkip
				},
				{
					name: "Effective Frame Skip",
					value: this._getEffectiveFrameSkip()
				},
				{
					name: "Full Rate Radius",
					value: this._lodFullRateRadius
				},
				{
					name: "Max Skip Distance",
					value: this._lodMaxSkipDistance
				},
				{
					name: "Max Frame Skip",
					value: this._lodMaxFrameSkip
				},
				{
					name: "Skip Lighting Too",
					value: this._frameSkipIncludesLighting
				}
			]
		});

		// Distance section (only if LOD enabled and model loaded)
		if (this._distanceLodEnabled && this._model?.isLoaded)
		{
			const camPos = this._getCameraPosition();
			const dx = this.x - camPos[0];
			const dy = this.y - camPos[1];
			const dz = this.totalZ - camPos[2];
			const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

			props.push({
				title: "Distance LOD Info",
				properties: [
					{
						name: "Distance to Camera",
						value: Math.round(distance)
					},
					{
						name: "Camera Position",
						value: `(${Math.round(camPos[0])}, ${Math.round(camPos[1])}, ${Math.round(camPos[2])})`
					},
					{
						name: "Update Rate",
						value: `1/${this._getEffectiveFrameSkip() + 1} frames`
					}
				]
			});
		}

		// Animation section (if animation controller exists)
		if (this._animationController)
		{
			props.push({
				title: "Animation",
				properties: [
					{
						name: "Current Animation",
						value: this._getAnimationName() || "(none)"
					},
					{
						name: "Playing",
						value: this._isAnimationPlaying()
					},
					{
						name: "Time",
						value: `${this._getAnimationTime().toFixed(2)}s / ${this._getAnimationDuration().toFixed(2)}s`
					},
					{
						name: "Speed",
						value: this._getAnimationSpeed()
					}
				]
			});
		}

		// Shadow Occlusion section (only shown when any shadow lights exist)
		const shadowLights = Lighting.getAllSpotLights().filter(l => l.shadow);
		if (shadowLights.length > 0)
		{
			const occlusionProps: object[] = [
				{
					name: "Physics Behavior",
					value: this._cachedPhysBeh !== undefined
						? (this._cachedPhysBeh ? "found" : "NOT FOUND — shadow disabled")
						: "(not yet checked)"
				}
			];
			for (const light of shadowLights)
			{
				const entry = this._lightOcclusionCache.get(light.id);
				let status: string;
				if (!entry)
					status = "(no raycast fired yet)";
				else
				{
					const rayCount = this._shadowRayCount;
					const hitCount = entry.rays.slice(0, rayCount).filter(r => r.hit).length;
					if (hitCount === 0)
						status = `clear (1.0x) [${rayCount} ray${rayCount > 1 ? "s" : ""}]`;
					else
						status = `OCCLUDED ${hitCount}/${rayCount} rays (${entry.factor.toFixed(2)}x)`;
				}
				occlusionProps.push({ name: `Light ${light.id} [${light.type ?? "spot"}]`, value: status });
			}
			props.push({ title: "Shadow Occlusion", properties: occlusionProps });
		}

		return props;
	}

	// ========================================================================
	// Texture Animation Methods (sprite-frame animation on built-in models)
	// ========================================================================

	/**
	 * Get the current texture animation from the assigned Sprite source.
	 * Returns null if no Sprite source is set or the animation doesn't exist.
	 */
	_getTextureAnimation(): any | null {
		if (!this._texSourceInst) return null;
		try {
			return this._texSourceInst.getAnimation(this._texAnimName);
		} catch (_) {}
		return null;
	}

	/**
	 * Set the Sprite instance to use as the texture animation source.
	 * Called from the SetTextureSource action.
	 */
	_setTextureSource(objectClass: any): void {
		const inst = objectClass?.getFirstPickedInstance?.() ?? objectClass?.getFirstInstance?.();
		if (!inst) {
			debugWarn("SetTextureSource: no Sprite instance found");
			return;
		}
		this._texSourceInst = inst;
		// Apply first frame immediately if model is ready
		if (this._model && this._useBuiltinModel) {
			this._updateTextureForFrame();
		}
	}

	/**
	 * Get the total number of frames in the current texture animation.
	 */
	_getTextureAnimFrameCount(): number {
		const anim = this._getTextureAnimation();
		if (!anim) return 0;
		return anim.frameCount ?? 0;
	}

	/**
	 * Update the model's texture to show the current animation frame.
	 */
	_updateTextureForFrame(): void {
		if (!this._model || !this._useBuiltinModel) return;
		const anim = this._getTextureAnimation();
		if (!anim) return;
		const frameCount = anim.frameCount ?? 0;
		if (frameCount === 0) return;
		const frameIndex = Math.max(0, Math.min(this._texAnimFrame, frameCount - 1));
		const frames = anim.getFrames();
		const frame = frames[frameIndex];
		if (!frame) return;
		const texture = frame.getTexture(this.runtime.renderer);
		if (!texture) return;
		const texRect = frame.getTexRect();
		this._model.updateExternalTexture(texture, texRect);
	}

	/**
	 * Advance texture animation by dt seconds.
	 * Reads speed from the animation's editor-configured speed, multiplied by _texAnimSpeedScale.
	 */
	_tickTextureAnimation(dt: number): void {
		if (!this._texAnimPlaying) return;
		const anim = this._getTextureAnimation();
		if (!anim) return;
		const frameCount = anim.frameCount ?? 0;
		if (frameCount <= 1) return;

		// animation.speed is frames per second from the editor
		const fps = (anim.speed ?? 5) * this._texAnimSpeedScale;
		if (fps <= 0) return;

		// Per-frame duration: duration is a relative multiplier (default 1)
		const allFrames = anim.getFrames();
		const currentFrame = allFrames[this._texAnimFrame];
		const frameDuration = (currentFrame?.duration ?? 1) / fps;

		this._texAnimAccumulator += dt;

		if (this._texAnimAccumulator >= frameDuration) {
			this._texAnimAccumulator -= frameDuration;
			// Clamp accumulator to avoid spiral-of-death on lag spikes
			if (this._texAnimAccumulator > frameDuration) {
				this._texAnimAccumulator = 0;
			}

			const isLooping = anim.isLooping ?? true;
			const isPingPong = anim.isPingPong ?? false;
			const repeatTo = anim.repeatTo ?? 0;
			const prevFrame = this._texAnimFrame;

			if (isPingPong) {
				if (this._texAnimForward) {
					this._texAnimFrame++;
					if (this._texAnimFrame >= frameCount) {
						this._texAnimFrame = frameCount - 2;
						this._texAnimForward = false;
						if (this._texAnimFrame < 0) {
							this._texAnimFrame = 0;
							this._texAnimForward = true;
						}
					}
				} else {
					this._texAnimFrame--;
					if (this._texAnimFrame < repeatTo) {
						if (isLooping) {
							this._texAnimFrame = repeatTo + 1;
							this._texAnimForward = true;
							if (this._texAnimFrame >= frameCount) {
								this._texAnimFrame = frameCount - 1;
							}
						} else {
							this._texAnimFrame = repeatTo;
							this._texAnimPlaying = false;
							this._trigger(C3.Plugins.GltfStatic.Cnds.OnTextureAnimFinished);
						}
					}
				}
			} else {
				// Normal forward playback
				this._texAnimFrame++;
				if (this._texAnimFrame >= frameCount) {
					if (isLooping) {
						this._texAnimFrame = repeatTo;
					} else {
						this._texAnimFrame = frameCount - 1;
						this._texAnimPlaying = false;
						this._trigger(C3.Plugins.GltfStatic.Cnds.OnTextureAnimFinished);
					}
				}
			}

			if (this._texAnimFrame !== prevFrame) {
				this._updateTextureForFrame();
				this._trigger(C3.Plugins.GltfStatic.Cnds.OnTextureFrameChanged);
			}
		}
	}

	/**
	 * Play the current texture animation.
	 * @param fromBeginning If true, restart from frame 0. If false, continue from current frame.
	 */
	_playTextureAnimation(fromBeginning: boolean): void {
		if (fromBeginning) {
			this._texAnimFrame = 0;
			this._texAnimAccumulator = 0;
			this._texAnimForward = true;
		}
		this._texAnimPlaying = true;
		this._updateTextureForFrame();
	}

	/**
	 * Stop the texture animation.
	 */
	_stopTextureAnimation(): void {
		this._texAnimPlaying = false;
	}

	/**
	 * Set the texture animation by name, optionally restarting from beginning.
	 */
	_setTextureAnimation(name: string, fromBeginning: boolean): void {
		this._texAnimName = name;
		if (fromBeginning) {
			this._texAnimFrame = 0;
			this._texAnimAccumulator = 0;
			this._texAnimForward = true;
		}
		this._updateTextureForFrame();
	}

	/**
	 * Set the current texture animation frame directly.
	 */
	_setTextureAnimFrame(frame: number): void {
		const count = this._getTextureAnimFrameCount();
		this._texAnimFrame = Math.max(0, Math.min(Math.floor(frame), count > 0 ? count - 1 : 0));
		this._texAnimAccumulator = 0;
		this._updateTextureForFrame();
	}

	/**
	 * Set the texture animation speed multiplier.
	 */
	_setTextureAnimSpeed(speed: number): void {
		this._texAnimSpeedScale = speed;
	}

	/**
	 * Check if texture animation is playing.
	 */
	_isTextureAnimPlaying(): boolean {
		return this._texAnimPlaying;
	}

	/**
	 * Get current texture animation frame index.
	 */
	_getTextureAnimFrame(): number {
		return this._texAnimFrame;
	}

	/**
	 * Get current texture animation speed multiplier.
	 */
	_getTextureAnimSpeed(): number {
		return this._texAnimSpeedScale;
	}

	/**
	 * Get current texture animation name.
	 */
	_getTextureAnimName(): string {
		return this._texAnimName;
	}

	_saveToJson(): JSONValue
	{
		return {
			"modelUrl": this._modelUrl,
			"rotationX": this._rotationX,
			"rotationY": this._rotationY,
			"rotationZ": this._rotationZ,
			"scaleX": this._scaleX,
			"scaleY": this._scaleY,
			"scaleZ": this._scaleZ,
			"texAnimPlaying": this._texAnimPlaying,
			"texAnimFrame": this._texAnimFrame,
			"texAnimSpeedScale": this._texAnimSpeedScale,
			"texAnimName": this._texAnimName,
			"texAnimForward": this._texAnimForward,
			"bboxScale": this._bboxScale,
			"convertAxes": this._convertAxes
		};
	}

	_loadFromJson(o: JSONValue): void
	{
		const data = o as JSONObject;
		this._modelUrl = data["modelUrl"] as string;
		this._rotationX = data["rotationX"] as number;
		this._rotationY = data["rotationY"] as number;
		this._rotationZ = data["rotationZ"] as number;
		// Support both old uniform scale and new per-axis scale
		if ("scaleX" in data)
		{
			this._scaleX = (data["scaleX"] as number) ?? 1;
			this._scaleY = (data["scaleY"] as number) ?? 1;
			this._scaleZ = (data["scaleZ"] as number) ?? 1;
		}
		else
		{
			// Legacy: uniform scale
			const uniformScale = (data["scale"] as number) ?? 1;
			this._scaleX = uniformScale;
			this._scaleY = uniformScale;
			this._scaleZ = uniformScale;
		}

		// Restore texture animation state (backward compatible with older saves)
		if ("texAnimPlaying" in data)
		{
			this._texAnimPlaying = data["texAnimPlaying"] as boolean;
			this._texAnimFrame = (data["texAnimFrame"] as number) ?? 0;
			this._texAnimSpeedScale = (data["texAnimSpeedScale"] as number) ?? 1;
			this._texAnimName = (data["texAnimName"] as string) ?? "Default";
			this._texAnimForward = (data["texAnimForward"] as boolean) ?? true;
		}

		// Restore bounding box scale (backward compatible)
		if ("bboxScale" in data)
		{
			this._bboxScale = (data["bboxScale"] as number) ?? 1;
		}

		// Restore axis conversion. Default false for projects saved before this feature
		// existed, so legacy projects don't shift visually on load.
		if ("convertAxes" in data)
		{
			this._convertAxes = (data["convertAxes"] as boolean) ?? false;
		}
		else
		{
			this._convertAxes = false;
		}

		// Reload model after restoring state
		if (this._modelUrl)
		{
			this._loadModel(this._modelUrl);
		}
	}
};

export type SDKInstanceClass = InstanceType<typeof C3.Plugins.GltfStatic.Instance>;
