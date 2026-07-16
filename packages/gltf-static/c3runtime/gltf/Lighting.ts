/**
 * Global Vertex Lighting System
 *
 * Provides script interface to create, enable, disable, and configure directional lights.
 * Uses globalThis for cross-module access (required for C3 worker compatibility).
 *
 * Light direction convention: direction vector points TO the light source (standard shader convention).
 */

import {
	calculateLightingInto,
	LIGHT_TYPE_SPOT,
	LIGHT_TYPE_POINT
} from "./LightingCore.js";
import type {
	LightingConfig,
	LightingConfigLight,
	LightingConfigSpot,
	LightType,
	ColorBlendMode
} from "./LightingCore.js";

// The lighting equation itself lives in LightingCore.ts so that the main thread
// and the worker share one implementation. This module owns the global light
// state and the scripting API on top of it.
export { LIGHT_TYPE_SPOT, LIGHT_TYPE_POINT };
export type { LightingConfig, LightType, ColorBlendMode };

// ============================================================================
// Light Types
// ============================================================================

/** A directional light, as stored in global state (adds an id to the core shape). */
export interface DirectionalLight extends LightingConfigLight {
	/** Unique identifier */
	id: number;
	/** Light color RGB (0-1) */
	color: Float32Array;
	/** Direction TO the light source (normalized) */
	direction: Float32Array;
}

/** A spot/point light, as stored in global state (adds id and shadow to the core shape). */
export interface SpotLight extends LightingConfigSpot {
	/** Unique identifier */
	id: number;
	/** Light color RGB (0-1) */
	color: Float32Array;
	/** World-space position [x, y, z] */
	position: Float32Array;
	/** Direction the spotlight points (normalized, cone axis) */
	direction: Float32Array;
	/** Whether physics-based shadow/occlusion raycasting is enabled for this light */
	shadow?: boolean;
}

// ============================================================================
// Global Light State (accessible via globalThis)
// ============================================================================

export interface HemisphereLight {
	/** Whether hemisphere light is enabled */
	enabled: boolean;
	/** Sky color RGB (0-1) - applied to upward-facing normals */
	skyColor: Float32Array;
	/** Ground color RGB (0-1) - applied to downward-facing normals */
	groundColor: Float32Array;
	/** Intensity multiplier */
	intensity: number;
}

export interface SpecularConfig {
	/** Specular power/exponent (higher = tighter highlight) */
	shininess: number;
	/** Global specular intensity multiplier */
	intensity: number;
	/** Debug mode: output pure blue for any specular contribution */
	debugBlue?: boolean;
}

declare global {
	var gltfLights: DirectionalLight[];
	var gltfSpotLights: SpotLight[];
	var gltfLightIdCounter: number;
	var gltfAmbientLight: Float32Array;
	var gltfHemisphereLight: HemisphereLight;
	var gltfSpecular: SpecularConfig;
	var gltfLightingVersion: number;
	var gltfColorBlendMode: ColorBlendMode;
}

// Initialize global light state if not exists
if (!globalThis.gltfLights) {
	globalThis.gltfLights = [];
	globalThis.gltfSpotLights = [];
	globalThis.gltfLightIdCounter = 0;
	globalThis.gltfAmbientLight = new Float32Array([1.0, 1.0, 1.0]);
	globalThis.gltfLightingVersion = 0;
}

// Initialize hemisphere light separately (may not exist from older versions)
if (!globalThis.gltfHemisphereLight) {
	globalThis.gltfHemisphereLight = {
		enabled: false,
		skyColor: new Float32Array([0.8, 0.9, 1.0]),      // Light blue sky
		groundColor: new Float32Array([0.2, 0.15, 0.1]),  // Brown ground
		intensity: 1.0
	};
}

// Initialize specular config (may not exist from older versions)
if (!globalThis.gltfSpecular) {
	globalThis.gltfSpecular = {
		shininess: 32.0,    // Default specular power
		intensity: 1.0      // Default specular intensity
	};
}

// Initialize color blend mode (for vertex color + lighting blending)
if (!globalThis.gltfColorBlendMode) {
	globalThis.gltfColorBlendMode = 'overlay';
}

// ============================================================================
// Dirty Tracking
// ============================================================================

/**
 * Get current lighting version. Increments when any light property changes.
 * Use to implement dirty checking and skip redundant lighting calculations.
 */
export function getVersion(): number {
	return globalThis.gltfLightingVersion;
}

/** Internal: bump version on any change */
function _markDirty(): void {
	globalThis.gltfLightingVersion++;
}

// ============================================================================
// Script Interface - Light Management
// ============================================================================

/**
 * Create a directional light.
 * @param dirX Direction X component (TO the light)
 * @param dirY Direction Y component (TO the light)
 * @param dirZ Direction Z component (TO the light)
 * @returns Light ID
 */
export function createDirectionalLight(dirX: number, dirY: number, dirZ: number): number {
	const id = globalThis.gltfLightIdCounter++;

	// Normalize direction
	const len = Math.sqrt(dirX * dirX + dirY * dirY + dirZ * dirZ);
	const nx = len > 0.0001 ? dirX / len : 0;
	const ny = len > 0.0001 ? dirY / len : 1;
	const nz = len > 0.0001 ? dirZ / len : 0;

	const light: DirectionalLight = {
		id,
		enabled: true,
		color: new Float32Array([1, 1, 1]),
		intensity: 1.0,
		direction: new Float32Array([nx, ny, nz]),
		specularEnabled: true
	};

	globalThis.gltfLights.push(light);
	_markDirty();
	return id;
}

/**
 * Get a light by ID.
 */
export function getLight(id: number): DirectionalLight | undefined {
	return globalThis.gltfLights.find(l => l.id === id);
}

/**
 * Get all lights.
 */
export function getAllLights(): readonly DirectionalLight[] {
	return globalThis.gltfLights;
}

/**
 * Remove a light by ID.
 */
export function removeLight(id: number): boolean {
	const index = globalThis.gltfLights.findIndex(l => l.id === id);
	if (index === -1) return false;
	globalThis.gltfLights.splice(index, 1);
	_markDirty();
	return true;
}

/**
 * Remove all lights.
 */
export function removeAllLights(): void {
	globalThis.gltfLights.length = 0;
	_markDirty();
}

// ============================================================================
// Script Interface - Light Configuration
// ============================================================================

/**
 * Enable or disable a light.
 */
export function setLightEnabled(id: number, enabled: boolean): void {
	const light = getLight(id);
	if (light && light.enabled !== enabled) {
		light.enabled = enabled;
		_markDirty();
	}
}

/**
 * Check if a light is enabled.
 */
export function isLightEnabled(id: number): boolean {
	return getLight(id)?.enabled ?? false;
}

/**
 * Set light color (RGB 0-1).
 */
export function setLightColor(id: number, r: number, g: number, b: number): void {
	const light = getLight(id);
	if (light) {
		light.color[0] = r;
		light.color[1] = g;
		light.color[2] = b;
		_markDirty();
	}
}

/**
 * Set light intensity.
 */
export function setLightIntensity(id: number, intensity: number): void {
	const light = getLight(id);
	if (light && light.intensity !== intensity) {
		light.intensity = Math.max(0, intensity);
		_markDirty();
	}
}

/**
 * Set light direction (TO the light source, will be normalized).
 */
export function setLightDirection(id: number, x: number, y: number, z: number): void {
	const light = getLight(id);
	if (!light) return;

	const len = Math.sqrt(x * x + y * y + z * z);
	if (len > 0.0001) {
		light.direction[0] = x / len;
		light.direction[1] = y / len;
		light.direction[2] = z / len;
		_markDirty();
	}
}

// ============================================================================
// Script Interface - Ambient Light
// ============================================================================

/**
 * Set global ambient light color (RGB 0-1).
 */
export function setAmbientLight(r: number, g: number, b: number): void {
	globalThis.gltfAmbientLight[0] = r;
	globalThis.gltfAmbientLight[1] = g;
	globalThis.gltfAmbientLight[2] = b;
	_markDirty();
}

/**
 * Get global ambient light color.
 */
export function getAmbientLight(): Float32Array {
	return globalThis.gltfAmbientLight;
}

// ============================================================================
// Script Interface - Hemisphere Light
// ============================================================================

/**
 * Enable or disable hemisphere lighting.
 * Hemisphere lighting blends between sky and ground colors based on normal.y.
 */
export function setHemisphereLightEnabled(enabled: boolean): void {
	if (globalThis.gltfHemisphereLight.enabled !== enabled) {
		globalThis.gltfHemisphereLight.enabled = enabled;
		_markDirty();
	}
}

/**
 * Check if hemisphere lighting is enabled.
 */
export function isHemisphereLightEnabled(): boolean {
	return globalThis.gltfHemisphereLight.enabled;
}

/**
 * Set hemisphere light sky color (RGB 0-1).
 * Applied to upward-facing normals (normal.y = 1).
 */
export function setHemisphereLightSkyColor(r: number, g: number, b: number): void {
	const h = globalThis.gltfHemisphereLight;
	h.skyColor[0] = r;
	h.skyColor[1] = g;
	h.skyColor[2] = b;
	_markDirty();
}

/**
 * Set hemisphere light ground color (RGB 0-1).
 * Applied to downward-facing normals (normal.y = -1).
 */
export function setHemisphereLightGroundColor(r: number, g: number, b: number): void {
	const h = globalThis.gltfHemisphereLight;
	h.groundColor[0] = r;
	h.groundColor[1] = g;
	h.groundColor[2] = b;
	_markDirty();
}

/**
 * Set hemisphere light intensity multiplier.
 */
export function setHemisphereLightIntensity(intensity: number): void {
	if (globalThis.gltfHemisphereLight.intensity !== intensity) {
		globalThis.gltfHemisphereLight.intensity = Math.max(0, intensity);
		_markDirty();
	}
}

/**
 * Get the hemisphere light configuration.
 */
export function getHemisphereLight(): HemisphereLight {
	// Ensure hemisphere light exists (may be missing from older versions)
	if (!globalThis.gltfHemisphereLight) {
		globalThis.gltfHemisphereLight = {
			enabled: false,
			skyColor: new Float32Array([0.8, 0.9, 1.0]),
			groundColor: new Float32Array([0.2, 0.15, 0.1]),
			intensity: 1.0
		};
	}
	return globalThis.gltfHemisphereLight;
}

// ============================================================================
// Script Interface - Specular Configuration
// ============================================================================

/**
 * Enable or disable specular for a directional light.
 */
export function setLightSpecularEnabled(id: number, enabled: boolean): void {
	const light = getLight(id);
	if (light && light.specularEnabled !== enabled) {
		light.specularEnabled = enabled;
		_markDirty();
	}
}

/**
 * Check if specular is enabled for a directional light.
 */
export function isLightSpecularEnabled(id: number): boolean {
	return getLight(id)?.specularEnabled ?? false;
}

/**
 * Enable or disable specular for a spotlight.
 */
export function setSpotLightSpecularEnabled(id: number, enabled: boolean): void {
	const light = getSpotLight(id);
	if (light && light.specularEnabled !== enabled) {
		light.specularEnabled = enabled;
		_markDirty();
	}
}

/**
 * Check if specular is enabled for a spotlight.
 */
export function isSpotLightSpecularEnabled(id: number): boolean {
	return getSpotLight(id)?.specularEnabled ?? false;
}

/**
 * Set global specular shininess (power/exponent).
 * Higher values = tighter, more focused highlights.
 */
export function setSpecularShininess(shininess: number): void {
	if (globalThis.gltfSpecular.shininess !== shininess) {
		globalThis.gltfSpecular.shininess = Math.max(1, shininess);
		_markDirty();
	}
}

/**
 * Get global specular shininess.
 */
export function getSpecularShininess(): number {
	return globalThis.gltfSpecular.shininess;
}

/**
 * Set global specular intensity multiplier.
 */
export function setSpecularIntensity(intensity: number): void {
	if (globalThis.gltfSpecular.intensity !== intensity) {
		globalThis.gltfSpecular.intensity = Math.max(0, intensity);
		_markDirty();
	}
}

/**
 * Get global specular intensity.
 */
export function getSpecularIntensity(): number {
	return globalThis.gltfSpecular.intensity;
}

/**
 * Enable/disable specular debug mode.
 * When enabled, any specular contribution shows as pure blue for visibility testing.
 */
export function setSpecularDebugBlue(enabled: boolean): void {
	if (globalThis.gltfSpecular.debugBlue !== enabled) {
		globalThis.gltfSpecular.debugBlue = enabled;
		_markDirty();
	}
}

/**
 * Check if specular debug mode is enabled.
 */
export function isSpecularDebugBlue(): boolean {
	return globalThis.gltfSpecular.debugBlue ?? false;
}

/**
 * Get the specular configuration.
 */
export function getSpecularConfig(): SpecularConfig {
	// Ensure specular config exists (may be missing from older versions)
	if (!globalThis.gltfSpecular) {
		globalThis.gltfSpecular = {
			shininess: 32.0,
			intensity: 1.0
		};
	}
	return globalThis.gltfSpecular;
}

// ============================================================================
// Script Interface - Color Blend Mode
// ============================================================================

/**
 * Set the color blend mode for combining vertex colors with lighting.
 * - 'none': Lighting only, ignore vertex colors
 * - 'multiply': lighting * vertexColor (vertex colors tint the lit surface)
 * - 'screen': 1 - (1-lighting) * (1-vertexColor) (brightening blend)
 * - 'overlay': Combines multiply and screen based on lighting value
 * - 'add': lighting + vertexColor (vertex colors add glow/emission)
 */
export function setColorBlendMode(mode: ColorBlendMode): void {
	if (globalThis.gltfColorBlendMode !== mode) {
		globalThis.gltfColorBlendMode = mode;
		_markDirty();
	}
}

/**
 * Get the current color blend mode.
 */
export function getColorBlendMode(): ColorBlendMode {
	return globalThis.gltfColorBlendMode ?? 'overlay';
}

// ============================================================================
// Script Interface - Spotlight Management
// ============================================================================

const DEG_TO_RAD = Math.PI / 180;

/**
 * Create a spotlight.
 * @param posX Position X
 * @param posY Position Y
 * @param posZ Position Z
 * @param dirX Direction X (cone axis, will be normalized)
 * @param dirY Direction Y
 * @param dirZ Direction Z
 * @param innerAngleDeg Inner cone angle in degrees (full intensity within)
 * @param outerAngleDeg Outer cone angle in degrees (zero intensity outside)
 * @param falloffExponent Edge falloff exponent (default 1.0 = linear)
 * @param range Maximum range (default 0 = infinite)
 * @returns Light ID
 */
export function createSpotLight(
	posX: number, posY: number, posZ: number,
	dirX: number, dirY: number, dirZ: number,
	innerAngleDeg: number, outerAngleDeg: number,
	falloffExponent: number = 1.0,
	range: number = 0
): number {
	const id = globalThis.gltfLightIdCounter++;

	// Normalize direction
	const len = Math.sqrt(dirX * dirX + dirY * dirY + dirZ * dirZ);
	const nx = len > 0.0001 ? dirX / len : 0;
	const ny = len > 0.0001 ? dirY / len : -1;
	const nz = len > 0.0001 ? dirZ / len : 0;

	// Ensure outer angle >= inner angle
	if (outerAngleDeg < innerAngleDeg) {
		outerAngleDeg = innerAngleDeg;
	}

	const light: SpotLight = {
		id,
		enabled: true,
		color: new Float32Array([1, 1, 1]),
		intensity: 1.0,
		position: new Float32Array([posX, posY, posZ]),
		direction: new Float32Array([nx, ny, nz]),
		innerConeAngle: innerAngleDeg * DEG_TO_RAD,
		outerConeAngle: outerAngleDeg * DEG_TO_RAD,
		falloffExponent: Math.max(0.01, falloffExponent),
		range: Math.max(0, range),
		specularEnabled: true
	};

	globalThis.gltfSpotLights.push(light);
	_markDirty();
	return id;
}

/**
 * Create a point light (illuminates in all directions, no cone restriction).
 * Point lights share the spotlight ID namespace and all setSpotLight* functions work on them.
 * @param posX Position X
 * @param posY Position Y
 * @param posZ Position Z
 * @param range Maximum range (default 0 = infinite)
 * @returns Light ID
 */
export function createPointLight(
	posX: number, posY: number, posZ: number,
	range: number = 0
): number {
	// Delegate to createSpotLight with a dummy direction, then mark as point type.
	// Direction is ignored during lighting when type === LIGHT_TYPE_POINT.
	const id = createSpotLight(posX, posY, posZ, 0, -1, 0, 0, 180, 1.0, range);
	getSpotLight(id)!.type = LIGHT_TYPE_POINT;
	return id;
}

/**
 * Set the type of a spotlight/point light.
 * @param id Light ID
 * @param type "spot" for cone-restricted spotlight, "point" for omnidirectional point light
 */
export function setSpotLightType(id: number, type: LightType): void {
	const light = getSpotLight(id);
	if (!light) return;
	// Treat undefined (lights created by createSpotLight) as "spot"
	const currentType = light.type ?? "spot";
	if (currentType !== type) {
		light.type = type;
		_markDirty();
	}
}

/**
 * Get a spotlight by ID.
 */
export function getSpotLight(id: number): SpotLight | undefined {
	return globalThis.gltfSpotLights.find(l => l.id === id);
}

/**
 * Get all spotlights.
 */
export function getAllSpotLights(): readonly SpotLight[] {
	return globalThis.gltfSpotLights;
}

/**
 * Remove a spotlight by ID.
 */
export function removeSpotLight(id: number): boolean {
	const index = globalThis.gltfSpotLights.findIndex(l => l.id === id);
	if (index === -1) return false;
	globalThis.gltfSpotLights.splice(index, 1);
	_markDirty();
	return true;
}

/**
 * Remove all spotlights.
 */
export function removeAllSpotLights(): void {
	globalThis.gltfSpotLights.length = 0;
	_markDirty();
}

// ============================================================================
// Script Interface - Spotlight Configuration
// ============================================================================

/**
 * Enable or disable a spotlight.
 */
export function setSpotLightEnabled(id: number, enabled: boolean): void {
	const light = getSpotLight(id);
	if (light && light.enabled !== enabled) {
		light.enabled = enabled;
		_markDirty();
	}
}

/**
 * Check if a spotlight is enabled.
 */
export function isSpotLightEnabled(id: number): boolean {
	return getSpotLight(id)?.enabled ?? false;
}

/**
 * Set spotlight color (RGB 0-1).
 */
export function setSpotLightColor(id: number, r: number, g: number, b: number): void {
	const light = getSpotLight(id);
	if (light) {
		light.color[0] = r;
		light.color[1] = g;
		light.color[2] = b;
		_markDirty();
	}
}

/**
 * Set spotlight intensity.
 */
export function setSpotLightIntensity(id: number, intensity: number): void {
	const light = getSpotLight(id);
	if (light && light.intensity !== intensity) {
		light.intensity = Math.max(0, intensity);
		_markDirty();
	}
}

/**
 * Set spotlight position.
 */
export function setSpotLightPosition(id: number, x: number, y: number, z: number): void {
	const light = getSpotLight(id);
	if (light) {
		light.position[0] = x;
		light.position[1] = y;
		light.position[2] = z;
		_markDirty();
	}
}

/**
 * Set spotlight direction (cone axis, will be normalized).
 */
export function setSpotLightDirection(id: number, x: number, y: number, z: number): void {
	const light = getSpotLight(id);
	if (!light) return;

	const len = Math.sqrt(x * x + y * y + z * z);
	if (len > 0.0001) {
		light.direction[0] = x / len;
		light.direction[1] = y / len;
		light.direction[2] = z / len;
		_markDirty();
	}
}

/**
 * Set spotlight cone angles (in degrees).
 */
export function setSpotLightConeAngles(id: number, innerAngleDeg: number, outerAngleDeg: number): void {
	const light = getSpotLight(id);
	if (!light) return;

	// Ensure outer angle >= inner angle
	if (outerAngleDeg < innerAngleDeg) {
		outerAngleDeg = innerAngleDeg;
	}

	light.innerConeAngle = innerAngleDeg * DEG_TO_RAD;
	light.outerConeAngle = outerAngleDeg * DEG_TO_RAD;
	_markDirty();
}

/**
 * Set spotlight edge falloff exponent.
 * 1.0 = linear, 2.0 = smooth quadratic, <1.0 = sharper
 */
export function setSpotLightFalloff(id: number, exponent: number): void {
	const light = getSpotLight(id);
	if (light) {
		light.falloffExponent = Math.max(0.01, exponent);
		_markDirty();
	}
}

/**
 * Set spotlight range (0 = infinite).
 */
export function setSpotLightRange(id: number, range: number): void {
	const light = getSpotLight(id);
	if (light) {
		light.range = Math.max(0, range);
		_markDirty();
	}
}

/**
 * Enable or disable physics-based shadow/occlusion raycasting for a spotlight.
 * When enabled, GltfStatic raycasts from itself to this light each frame and
 * reduces its effective intensity when occluded by a physics body.
 * Note: shadow is read by GltfStatic's raycast logic, not the lighting shader,
 * so no lighting version bump is needed.
 */
export function setSpotLightShadow(id: number, enabled: boolean): void {
	const light = getSpotLight(id);
	if (light && light.shadow !== enabled) {
		light.shadow = enabled;
	}
}

/**
 * Get the number of spotlights.
 */
export function getSpotLightCount(): number {
	return globalThis.gltfSpotLights.length;
}

/**
 * Check if any spotlights exist and are enabled.
 */
export function hasEnabledSpotLights(): boolean {
	const lights = globalThis.gltfSpotLights;
	for (let i = 0; i < lights.length; i++) {
		if (lights[i].enabled) return true;
	}
	return false;
}

// ============================================================================
// Lighting Calculation
// ============================================================================

/**
 * Calculate lighting for an entire mesh.
 * Updates vertex colors based on normals and light configuration.
 *
 * @param positions Vertex positions (3 floats per vertex, model space) - required for spotlights
 * @param normals Vertex normals (3 floats per vertex, model space, normalized)
 * @param outColors Output vertex colors (4 floats per vertex: r, g, b, a)
 * @param vertexCount Number of vertices
 * @param modelMatrix Optional 4x4 model matrix to transform positions/normals to world space.
 *                    Pass null/undefined to skip transformation (already in world space).
 *                    Format: 16-element column-major mat4 (gl-matrix style)
 */
/**
 * Build a LightingConfig snapshot from the current global light state.
 *
 * This is the one place that reads globalThis for the purpose of running the
 * lighting equation. The worker is handed the same shape as a structured-cloned
 * snapshot, so both threads feed LightingCore identical input.
 */
export function getGlobalLightingConfig(cameraPosition?: Float32Array | null): LightingConfig {
	return {
		ambient: globalThis.gltfAmbientLight,
		lights: globalThis.gltfLights,
		spotLights: globalThis.gltfSpotLights,
		hemisphere: globalThis.gltfHemisphereLight,
		specular: globalThis.gltfSpecular,
		cameraPosition: cameraPosition ?? null,
		colorBlendMode: globalThis.gltfColorBlendMode
	};
}

/**
 * Calculate vertex lighting for a mesh from the current global light state.
 *
 * Thin wrapper over LightingCore.calculateLightingInto — the equation itself is
 * shared with the worker. See LightingCore.ts.
 *
 * @param positions Vertex positions (3 floats per vertex, model space) - required for spotlights
 * @param normals Vertex normals (3 floats per vertex, model space, normalized)
 * @param outColors Output vertex colors (4 floats per vertex: r, g, b, a)
 * @param vertexCount Number of vertices
 * @param modelMatrix Optional 4x4 column-major model matrix taking positions/normals
 *                    to world space. Pass null/undefined if already world space.
 * @param cameraPosition Camera world position, required for specular
 * @param sourceColors Optional vertex colors / baseColorFactor to blend with the result
 */
export function calculateMeshLighting(
	positions: Float32Array | null,
	normals: Float32Array,
	outColors: Float32Array,
	vertexCount: number,
	modelMatrix?: Float32Array | null,
	cameraPosition?: Float32Array | null,
	sourceColors?: Float32Array | null
): void {
	calculateLightingInto(
		positions, normals, outColors,
		0, 0, 0,
		vertexCount,
		modelMatrix, sourceColors,
		getGlobalLightingConfig(cameraPosition)
	);
}

/**
 * Check if any lights exist and are enabled.
 */
export function hasEnabledLights(): boolean {
	const lights = globalThis.gltfLights;
	for (let i = 0; i < lights.length; i++) {
		if (lights[i].enabled) return true;
	}
	return false;
}

/**
 * Get the number of lights.
 */
export function getLightCount(): number {
	return globalThis.gltfLights.length;
}

// Store last camera info for debugging
let _debugCameraPosition: Float32Array | null = null;
let _debugCameraDirection: Float32Array | null = null;

/**
 * Set camera position/direction for debug purposes.
 * Called automatically by instance when building light config.
 */
export function setDebugCamera(position: Float32Array | null, direction?: Float32Array | null): void {
	_debugCameraPosition = position;
	_debugCameraDirection = direction || null;
}

/**
 * Debug function to dump current lighting state to console.
 * Call from console: globalThis.GltfBundle.Lighting.debugLightingState()
 */
export function debugLightingState(): void {
	console.log("=== LIGHTING DEBUG STATE ===");
	console.log("Ambient:", Array.from(globalThis.gltfAmbientLight));
	console.log("Specular Config:", globalThis.gltfSpecular);
	console.log("Hemisphere:", globalThis.gltfHemisphereLight);
	console.log("Lighting Version:", globalThis.gltfLightingVersion);

	console.log("\nCamera:");
	if (_debugCameraPosition) {
		console.log("  Position:", Array.from(_debugCameraPosition));
	} else {
		console.log("  Position: NOT SET (specular won't work)");
	}
	if (_debugCameraDirection) {
		console.log("  Direction:", Array.from(_debugCameraDirection));
	}

	console.log("\nDirectional Lights (" + globalThis.gltfLights.length + "):");
	globalThis.gltfLights.forEach((light, i) => {
		console.log(`  [${i}] id=${light.id}, enabled=${light.enabled}, specularEnabled=${light.specularEnabled}`);
		console.log(`      color=[${Array.from(light.color)}], intensity=${light.intensity}`);
		console.log(`      direction=[${Array.from(light.direction)}]`);
	});

	console.log("\nSpotlights (" + globalThis.gltfSpotLights.length + "):");
	globalThis.gltfSpotLights.forEach((light, i) => {
		const typeLabel = light.type ?? "spot";
		const shadowLabel = light.shadow ? "shadow=ON" : "shadow=off";
		console.log(`  [${i}] id=${light.id}, type=${typeLabel}, enabled=${light.enabled}, ${shadowLabel}, specularEnabled=${light.specularEnabled}`);
		console.log(`      color=[${Array.from(light.color)}], intensity=${light.intensity}`);
		console.log(`      position=[${Array.from(light.position)}]`);
		if (typeLabel !== "point") {
			console.log(`      direction=[${Array.from(light.direction)}]`);
			console.log(`      innerConeAngle=${(light.innerConeAngle * 180 / Math.PI).toFixed(1)}°, outerConeAngle=${(light.outerConeAngle * 180 / Math.PI).toFixed(1)}°`);
		}
		if (light.range > 0) console.log(`      range=${light.range}`);
	});

	console.log("=== END DEBUG STATE ===");
}
