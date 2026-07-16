/**
 * Vertex Lighting — pure math core.
 *
 * This module is the SINGLE implementation of the vertex lighting equation. It is
 * deliberately free of `globalThis` reads and of any other side effects, so that:
 *
 *   - the main thread can call it via Lighting.ts, which supplies a config built
 *     from the global light state, and
 *   - the worker can call it with a config snapshot that was posted to it,
 *     by bundling THIS file into the worker blob at build time (see build.js).
 *
 * Previously the worker carried a hand-mirrored copy of this math as a string
 * literal, which had already drifted (the copy silently dropped vertex colors).
 * Keep this file pure — anything that reads global state belongs in Lighting.ts.
 *
 * Light direction convention: direction vector points TO the light source.
 */

// ============================================================================
// Light Types
// ============================================================================

/** Accepts either a Float32Array (main thread) or a plain array (posted config). */
export type Vec3Like = Float32Array | number[];

/** Positional light mode: cone-restricted spotlight or omnidirectional point light */
export type LightType = "spot" | "point";
export const LIGHT_TYPE_SPOT: LightType = "spot";
export const LIGHT_TYPE_POINT: LightType = "point";

export type ColorBlendMode = 'none' | 'multiply' | 'screen' | 'overlay' | 'add';

/** The directional-light fields the lighting equation actually reads. */
export interface LightingConfigLight {
	/** Whether light is enabled */
	enabled: boolean;
	/** Light color RGB (0-1) */
	color: Vec3Like;
	/** Light intensity multiplier */
	intensity: number;
	/** Direction TO the light source (normalized) */
	direction: Vec3Like;
	/** Whether this light contributes specular highlights */
	specularEnabled: boolean;
}

/** The spot/point-light fields the lighting equation actually reads. */
export interface LightingConfigSpot {
	/** Whether light is enabled */
	enabled: boolean;
	/** Light color RGB (0-1) */
	color: Vec3Like;
	/** Light intensity multiplier */
	intensity: number;
	/** World-space position [x, y, z] */
	position: Vec3Like;
	/** Direction the spotlight points (normalized, cone axis) */
	direction: Vec3Like;
	/** Inner cone angle in radians (full intensity within this) */
	innerConeAngle: number;
	/** Outer cone angle in radians (zero intensity outside this) */
	outerConeAngle: number;
	/** Edge falloff exponent (1.0 = linear, higher = sharper transition) */
	falloffExponent: number;
	/** Maximum range (0 = infinite, no distance attenuation) */
	range: number;
	/** Whether this light contributes specular highlights */
	specularEnabled: boolean;
	/** Light type: "spot" applies cone attenuation, "point" illuminates all directions */
	type?: LightType;
}

export interface LightingConfigHemisphere {
	/** Whether hemisphere light is enabled */
	enabled: boolean;
	/** Sky color RGB (0-1) - applied to upward-facing normals */
	skyColor: Vec3Like;
	/** Ground color RGB (0-1) - applied to downward-facing normals */
	groundColor: Vec3Like;
	/** Intensity multiplier */
	intensity: number;
}

export interface LightingConfigSpecular {
	/** Specular power/exponent (higher = tighter highlight) */
	shininess: number;
	/** Global specular intensity multiplier */
	intensity: number;
	/** Debug mode: output pure blue for any specular contribution */
	debugBlue?: boolean;
}

/**
 * Everything the lighting equation needs, passed explicitly.
 *
 * On the main thread this is built from globalThis by Lighting.getGlobalLightingConfig().
 * In the worker it arrives as a structured-cloned snapshot.
 */
export interface LightingConfig {
	/** Ambient RGB */
	ambient: Vec3Like;
	/** Directional lights */
	lights: ReadonlyArray<LightingConfigLight>;
	/** Spot and point lights */
	spotLights?: ReadonlyArray<LightingConfigSpot>;
	/** Hemisphere light (blends sky/ground colors based on normal.z for Z-up) */
	hemisphere?: LightingConfigHemisphere;
	/** Specular configuration */
	specular?: LightingConfigSpecular;
	/** Camera world position, required for specular */
	cameraPosition?: Vec3Like | null;
	/** How vertex colors blend with the lighting result */
	colorBlendMode?: ColorBlendMode;
}

// ============================================================================
// The lighting equation
// ============================================================================

/**
 * Calculate vertex lighting into an output color buffer.
 *
 * Buffers may be packed (multiple meshes in one array), hence the explicit
 * offsets. `sourceColors` is always a per-mesh array indexed from 0.
 *
 * @param positions Vertex positions, model space (3 floats/vertex). Required for
 *                  spot/point lights and specular; pass null if unavailable.
 * @param normals Vertex normals, model space, normalized (3 floats/vertex)
 * @param outColors Output RGBA (4 floats/vertex)
 * @param posOffset Offset into positions, in floats (vertex * 3)
 * @param normalOffset Offset into normals, in floats (vertex * 3)
 * @param colorOffset Offset into outColors, in floats (vertex * 4)
 * @param vertexCount Number of vertices to light
 * @param modelMatrix Optional column-major mat4 taking positions/normals to world
 *                    space. Pass null to treat inputs as already world space.
 * @param sourceColors Optional per-mesh vertex colors / baseColorFactor (4 floats/vertex)
 * @param config Light state
 */
export function calculateLightingInto(
	positions: Float32Array | null,
	normals: Float32Array,
	outColors: Float32Array,
	posOffset: number,
	normalOffset: number,
	colorOffset: number,
	vertexCount: number,
	modelMatrix: Float32Array | null | undefined,
	sourceColors: Float32Array | null | undefined,
	config: LightingConfig
): void {
	const ambient = config.ambient;
	const lights = config.lights;
	const spotLights = config.spotLights || [];
	const specular = config.specular;
	const cameraPosition = config.cameraPosition;
	const hemisphere = config.hemisphere;
	const blendMode = config.colorBlendMode;

	// Extract matrix components if provided (4x4 column-major)
	const hasMatrix = !!modelMatrix && modelMatrix.length >= 16;

	// Rotation/scale part (upper-left 3x3)
	let m00 = 1, m01 = 0, m02 = 0;
	let m10 = 0, m11 = 1, m12 = 0;
	let m20 = 0, m21 = 0, m22 = 1;
	// Translation part
	let tx = 0, ty = 0, tz = 0;

	if (hasMatrix) {
		const m = modelMatrix!;
		m00 = m[0]; m01 = m[4]; m02 = m[8];
		m10 = m[1]; m11 = m[5]; m12 = m[9];
		m20 = m[2]; m21 = m[6]; m22 = m[10];
		tx = m[12]; ty = m[13]; tz = m[14];
	}

	// Check if we have spotlights to process
	const hasSpotLights = spotLights.length > 0 && positions !== null;

	// Check if we can do specular (need camera position and vertex positions)
	const canDoSpecular = !!cameraPosition && cameraPosition.length >= 3 &&
		positions !== null && !!specular && specular.intensity > 0;

	const hemisphereEnabled = !!hemisphere && hemisphere.enabled;

	for (let i = 0; i < vertexCount; i++) {
		const pOff3 = posOffset + i * 3;
		const nOff3 = normalOffset + i * 3;
		const off4 = colorOffset + i * 4;
		const srcOff4 = i * 4;

		// Start with ambient
		let r = ambient[0];
		let g = ambient[1];
		let b = ambient[2];

		// Normal components (model space)
		let nx = normals[nOff3];
		let ny = normals[nOff3 + 1];
		let nz = normals[nOff3 + 2];

		// Transform normal to world space if matrix provided
		if (hasMatrix) {
			const wnx = m00 * nx + m01 * ny + m02 * nz;
			const wny = m10 * nx + m11 * ny + m12 * nz;
			const wnz = m20 * nx + m21 * ny + m22 * nz;
			// Renormalize in case of non-uniform scale
			const len = Math.sqrt(wnx * wnx + wny * wny + wnz * wnz);
			if (len > 0.0001) {
				nx = wnx / len;
				ny = wny / len;
				nz = wnz / len;
			}
		}

		// Hemisphere light contribution (blend sky/ground based on normal.z for Z-up)
		if (hemisphereEnabled) {
			const hemi = hemisphere!;
			// Blend factor: normal.z from [-1, 1] maps to [0, 1]
			const blend = (nz + 1) * 0.5;
			const invBlend = 1 - blend;
			const hemiIntensity = hemi.intensity;
			r += (hemi.groundColor[0] * invBlend + hemi.skyColor[0] * blend) * hemiIntensity;
			g += (hemi.groundColor[1] * invBlend + hemi.skyColor[1] * blend) * hemiIntensity;
			b += (hemi.groundColor[2] * invBlend + hemi.skyColor[2] * blend) * hemiIntensity;
		}

		// Get vertex world position (needed for spotlights and specular)
		let px = 0, py = 0, pz = 0;
		let viewX = 0, viewY = 0, viewZ = 0;
		const needsWorldPos = hasSpotLights || canDoSpecular;

		if (needsWorldPos && positions) {
			px = positions[pOff3];
			py = positions[pOff3 + 1];
			pz = positions[pOff3 + 2];

			// Transform position to world space if matrix provided
			if (hasMatrix) {
				const wpx = m00 * px + m01 * py + m02 * pz + tx;
				const wpy = m10 * px + m11 * py + m12 * pz + ty;
				const wpz = m20 * px + m21 * py + m22 * pz + tz;
				px = wpx;
				py = wpy;
				pz = wpz;
			}

			// Calculate view direction for specular (vertex to camera)
			if (canDoSpecular) {
				const vx = cameraPosition![0] - px;
				const vy = cameraPosition![1] - py;
				const vz = cameraPosition![2] - pz;
				const vLen = Math.sqrt(vx * vx + vy * vy + vz * vz);
				if (vLen > 0.0001) {
					viewX = vx / vLen;
					viewY = vy / vLen;
					viewZ = vz / vLen;
				}
			}
		}

		// Accumulate contribution from all enabled directional lights
		for (let j = 0; j < lights.length; j++) {
			const light = lights[j];
			if (!light.enabled) continue;

			// Light direction (TO light, already normalized)
			const lightDirX = light.direction[0];
			const lightDirY = light.direction[1];
			const lightDirZ = light.direction[2];

			// N dot L (both normalized, direction is TO light)
			const NdotL = nx * lightDirX + ny * lightDirY + nz * lightDirZ;

			if (NdotL > 0) {
				// Diffuse contribution
				const contrib = NdotL * light.intensity;
				r += light.color[0] * contrib;
				g += light.color[1] * contrib;
				b += light.color[2] * contrib;

				// Specular contribution (Blinn-Phong)
				if (canDoSpecular && light.specularEnabled) {
					// Half vector: normalize(lightDir + viewDir)
					const hx = lightDirX + viewX;
					const hy = lightDirY + viewY;
					const hz = lightDirZ + viewZ;
					const hLen = Math.sqrt(hx * hx + hy * hy + hz * hz);
					if (hLen > 0.0001) {
						const halfX = hx / hLen;
						const halfY = hy / hLen;
						const halfZ = hz / hLen;

						const NdotH = nx * halfX + ny * halfY + nz * halfZ;

						// Debug mode: show blue regardless of NdotH sign (helps diagnose inversions)
						if (specular!.debugBlue) {
							if (Math.abs(NdotH) > 0.01) {
								b += 1.0;
							}
						} else {
							// Clamp to avoid NaN from negative values with fractional exponents
							const spec = Math.pow(Math.max(0, NdotH), specular!.shininess) * specular!.intensity * light.intensity;
							r += light.color[0] * spec;
							g += light.color[1] * spec;
							b += light.color[2] * spec;
						}
					}
				}
			}
		}

		// Accumulate contribution from all enabled spot/point lights
		if (hasSpotLights) {
			for (let j = 0; j < spotLights.length; j++) {
				const spot = spotLights[j];
				if (!spot.enabled) continue;

				// Vector from light to vertex
				const dx = px - spot.position[0];
				const dy = py - spot.position[1];
				const dz = pz - spot.position[2];
				const distSq = dx * dx + dy * dy + dz * dz;
				const dist = Math.sqrt(distSq);

				if (dist < 0.0001) continue; // Avoid division by zero

				// Normalize direction from light to vertex
				const invDist = 1 / dist;
				const toVertX = dx * invDist;
				const toVertY = dy * invDist;
				const toVertZ = dz * invDist;

				// Angular falloff (skipped for point lights)
				let angularAtten = 1;
				if (spot.type !== LIGHT_TYPE_POINT) {
					// spot.direction points in the direction the light shines
					const cosAngle = spot.direction[0] * toVertX + spot.direction[1] * toVertY + spot.direction[2] * toVertZ;

					// Precompute cone angle cosines
					const innerCos = Math.cos(spot.innerConeAngle);
					const outerCos = Math.cos(spot.outerConeAngle);

					// Outside outer cone - no contribution
					if (cosAngle <= outerCos) continue;

					// Calculate angular attenuation
					if (cosAngle >= innerCos) {
						// Inside inner cone - full intensity
						angularAtten = 1;
					} else {
						// In penumbra - smooth falloff
						const t = (cosAngle - outerCos) / (innerCos - outerCos);
						angularAtten = Math.pow(t, spot.falloffExponent);
					}
				}

				// Distance attenuation
				let distAtten = 1;
				if (spot.range > 0) {
					// Smooth falloff to zero at range
					if (dist >= spot.range) continue;
					const normalizedDist = dist / spot.range;
					const rangeAtten = 1 - normalizedDist * normalizedDist;
					distAtten = rangeAtten * rangeAtten;
				} else {
					// Inverse square falloff (with offset to avoid infinity at 0)
					distAtten = 1 / (1 + distSq);
				}

				// N dot L: direction FROM vertex TO light is negative of toVert
				const lightDirX = -toVertX;
				const lightDirY = -toVertY;
				const lightDirZ = -toVertZ;
				const NdotL = nx * lightDirX + ny * lightDirY + nz * lightDirZ;

				if (NdotL > 0) {
					// Diffuse contribution
					const contrib = NdotL * spot.intensity * angularAtten * distAtten;
					r += spot.color[0] * contrib;
					g += spot.color[1] * contrib;
					b += spot.color[2] * contrib;

					// Specular contribution (Blinn-Phong)
					if (canDoSpecular && spot.specularEnabled) {
						// Half vector: normalize(lightDir + viewDir)
						const hx = lightDirX + viewX;
						const hy = lightDirY + viewY;
						const hz = lightDirZ + viewZ;
						const hLen = Math.sqrt(hx * hx + hy * hy + hz * hz);
						if (hLen > 0.0001) {
							const halfX = hx / hLen;
							const halfY = hy / hLen;
							const halfZ = hz / hLen;

							const NdotH = nx * halfX + ny * halfY + nz * halfZ;

							// Debug mode: show blue regardless of NdotH sign
							if (specular!.debugBlue) {
								if (Math.abs(NdotH) > 0.01) {
									b += 1.0;
								}
							} else {
								// Clamp to avoid NaN from negative values with fractional exponents
								const spec = Math.pow(Math.max(0, NdotH), specular!.shininess) * specular!.intensity * spot.intensity * angularAtten * distAtten;
								r += spot.color[0] * spec;
								g += spot.color[1] * spec;
								b += spot.color[2] * spec;
							}
						}
					}
				}
			}
		}

		// Apply blend with source vertex colors
		if (sourceColors) {
			const srcR = sourceColors[srcOff4];
			const srcG = sourceColors[srcOff4 + 1];
			const srcB = sourceColors[srcOff4 + 2];

			switch (blendMode) {
				case 'multiply':
					r *= srcR; g *= srcG; b *= srcB;
					break;
				case 'screen':
					r = 1 - (1 - r) * (1 - srcR);
					g = 1 - (1 - g) * (1 - srcG);
					b = 1 - (1 - b) * (1 - srcB);
					break;
				case 'overlay':
					r = r < 0.5 ? 2 * r * srcR : 1 - 2 * (1 - r) * (1 - srcR);
					g = g < 0.5 ? 2 * g * srcG : 1 - 2 * (1 - g) * (1 - srcG);
					b = b < 0.5 ? 2 * b * srcB : 1 - 2 * (1 - b) * (1 - srcB);
					break;
				case 'add':
					r += srcR; g += srcG; b += srcB;
					break;
				// 'none' / undefined: no blending, lighting only
			}
		}

		// Write output (clamped, alpha = 1)
		outColors[off4] = r > 2 ? 2 : r;
		outColors[off4 + 1] = g > 2 ? 2 : g;
		outColors[off4 + 2] = b > 2 ? 2 : b;
		outColors[off4 + 3] = 1;
	}
}
