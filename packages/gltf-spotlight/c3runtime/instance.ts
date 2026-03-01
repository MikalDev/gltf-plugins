// Lighting API type (exposed by glTF Static via globalThis.GltfBundle.Lighting)
interface LightingAPI {
	createSpotLight(
		x: number, y: number, z: number,
		dirX: number, dirY: number, dirZ: number,
		innerAngle: number, outerAngle: number,
		falloffExponent: number, range: number
	): number;
	createPointLight(
		x: number, y: number, z: number,
		range: number
	): number;
	removeSpotLight(id: number): boolean;
	setSpotLightEnabled(id: number, enabled: boolean): void;
	setSpotLightColor(id: number, r: number, g: number, b: number): void;
	setSpotLightIntensity(id: number, intensity: number): void;
	setSpotLightPosition(id: number, x: number, y: number, z: number): void;
	setSpotLightDirection(id: number, x: number, y: number, z: number): void;
	setSpotLightConeAngles(id: number, innerAngle: number, outerAngle: number): void;
	setSpotLightRange(id: number, range: number): void;
	setSpotLightType(id: number, type: string): void;
}

declare global {
	var GltfBundle: {
		Lighting: LightingAPI;
	} | undefined;
}

// Light type constants
const LIGHT_TYPE_SPOT  = "spot";
const LIGHT_TYPE_POINT = "point";

// Combo index for the LightType property (must match plugin.ts items order: ["spot", "point"])
const COMBO_LIGHT_TYPE_SPOT  = 0;
const COMBO_LIGHT_TYPE_POINT = 1;

// Property indices matching plugin.ts order
const PROP_LIGHT_TYPE  = 0;
const PROP_ENABLED     = 1;
const PROP_COLOR       = 2;
const PROP_INTENSITY   = 3;
const PROP_INNER_ANGLE = 4;
const PROP_OUTER_ANGLE = 5;
const PROP_RANGE       = 6;
const PROP_DIR_X       = 7;
const PROP_DIR_Y       = 8;
const PROP_DIR_Z       = 9;

/**
 * Get the Lighting API if available (glTF Static loaded)
 */
function getLightingAPI(): LightingAPI | undefined {
	return globalThis.GltfBundle?.Lighting;
}

C3.Plugins.GltfSpotlight.Instance = class GltfSpotlightInstance extends ISDKWorldInstanceBase
{
	_lightId: number = -1;
	_lightType: string = LIGHT_TYPE_SPOT;
	_enabled: boolean = true;
	_color: [number, number, number] = [1, 1, 1];
	_intensity: number = 1;
	_innerAngle: number = 15;
	_outerAngle: number = 30;
	_range: number = 10000;
	_dirX: number = 1;
	_dirY: number = 0;
	_dirZ: number = 0;

	// Dirty tracking for position updates
	_lastX: number = NaN;
	_lastY: number = NaN;
	_lastZ: number = NaN;
	_needsUpdate: boolean = true;

	constructor()
	{
		super();

		const properties = this._getInitProperties();
		if (properties)
		{
			// PROP_LIGHT_TYPE is combo: COMBO_LIGHT_TYPE_SPOT=0, COMBO_LIGHT_TYPE_POINT=1
			this._lightType = (properties[PROP_LIGHT_TYPE] as number) === COMBO_LIGHT_TYPE_POINT ? LIGHT_TYPE_POINT : LIGHT_TYPE_SPOT;
			this._enabled = properties[PROP_ENABLED] as boolean;
			// Color comes as [r, g, b] array already in 0-1 range (SDK v2)
			this._color = properties[PROP_COLOR] as unknown as [number, number, number];
			this._intensity = properties[PROP_INTENSITY] as number;
			this._innerAngle = properties[PROP_INNER_ANGLE] as number;
			this._outerAngle = properties[PROP_OUTER_ANGLE] as number;
			this._range = properties[PROP_RANGE] as number;
			this._dirX = properties[PROP_DIR_X] as number;
			this._dirY = properties[PROP_DIR_Y] as number;
			this._dirZ = properties[PROP_DIR_Z] as number;
		}

		this._createLight();

		// Enable ticking so _tick() is called each frame
		this._setTicking(true);
	}

	_release(): void
	{
		// Stop ticking
		this._setTicking(false);

		const Lighting = getLightingAPI();
		if (Lighting && this._lightId >= 0)
		{
			Lighting.removeSpotLight(this._lightId);
		}

		super._release();
	}

	_createLight(): void
	{
		const Lighting = getLightingAPI();
		if (!Lighting) return;  // glTF Static not loaded yet

		if (this._lightType === LIGHT_TYPE_POINT)
		{
			this._lightId = Lighting.createPointLight(
				this.x, this.y, this.totalZ,
				this._range
			);
		}
		else
		{
			this._lightId = Lighting.createSpotLight(
				this.x, this.y, this.totalZ,
				this._dirX, this._dirY, this._dirZ,
				this._innerAngle, this._outerAngle,
				1.0,  // falloffExponent
				this._range
			);
		}

		// Set common properties
		Lighting.setSpotLightEnabled(this._lightId, this._enabled);
		Lighting.setSpotLightColor(this._lightId, this._color[0], this._color[1], this._color[2]);
		Lighting.setSpotLightIntensity(this._lightId, this._intensity);
	}

	_updateLight(): void
	{
		const Lighting = getLightingAPI();

		// If API not available yet, try to create the light
		if (!Lighting)
		{
			return;
		}

		// If light not created yet (API became available), create it now
		if (this._lightId < 0)
		{
			this._createLight();
			return;
		}

		// Update common properties via Lighting API
		Lighting.setSpotLightType(this._lightId, this._lightType);
		Lighting.setSpotLightEnabled(this._lightId, this._enabled);
		Lighting.setSpotLightColor(this._lightId, this._color[0], this._color[1], this._color[2]);
		Lighting.setSpotLightIntensity(this._lightId, this._intensity);
		Lighting.setSpotLightPosition(this._lightId, this.x, this.y, this.totalZ);
		Lighting.setSpotLightRange(this._lightId, this._range);

		// Spotlight-specific updates (skipped for point lights)
		if (this._lightType !== LIGHT_TYPE_POINT)
		{
			Lighting.setSpotLightDirection(this._lightId, this._dirX, this._dirY, this._dirZ);
			Lighting.setSpotLightConeAngles(this._lightId, this._innerAngle, this._outerAngle);
		}
	}

	_tick(): void
	{
		// Check if position changed or update is needed
		const currentX = this.x;
		const currentY = this.y;
		const currentZ = this.totalZ;

		const positionChanged = currentX !== this._lastX ||
		                        currentY !== this._lastY ||
		                        currentZ !== this._lastZ;

		if (positionChanged || this._needsUpdate)
		{
			this._lastX = currentX;
			this._lastY = currentY;
			this._lastZ = currentZ;
			this._needsUpdate = false;
			this._updateLight();
		}
	}

	// === Actions ===

	_SetLightType(typeIdx: number): void
	{
		this._lightType = typeIdx === COMBO_LIGHT_TYPE_POINT ? LIGHT_TYPE_POINT : LIGHT_TYPE_SPOT;
		const Lighting = getLightingAPI();
		if (Lighting && this._lightId >= 0)
		{
			Lighting.setSpotLightType(this._lightId, this._lightType);
		}
	}

	_SetEnabled(enabled: number): void
	{
		this._enabled = (enabled === 1);
		const Lighting = getLightingAPI();
		if (Lighting && this._lightId >= 0)
		{
			Lighting.setSpotLightEnabled(this._lightId, this._enabled);
		}
	}

	_SetColor(r: number, g: number, b: number): void
	{
		this._color = [r / 255, g / 255, b / 255];
		const Lighting = getLightingAPI();
		if (Lighting && this._lightId >= 0)
		{
			Lighting.setSpotLightColor(this._lightId, this._color[0], this._color[1], this._color[2]);
		}
	}

	_SetIntensity(intensity: number): void
	{
		this._intensity = intensity;
		const Lighting = getLightingAPI();
		if (Lighting && this._lightId >= 0)
		{
			Lighting.setSpotLightIntensity(this._lightId, intensity);
		}
	}

	_SetInnerAngle(angle: number): void
	{
		this._innerAngle = angle;
		const Lighting = getLightingAPI();
		if (Lighting && this._lightId >= 0 && this._lightType !== LIGHT_TYPE_POINT)
		{
			Lighting.setSpotLightConeAngles(this._lightId, this._innerAngle, this._outerAngle);
		}
	}

	_SetOuterAngle(angle: number): void
	{
		this._outerAngle = angle;
		const Lighting = getLightingAPI();
		if (Lighting && this._lightId >= 0 && this._lightType !== LIGHT_TYPE_POINT)
		{
			Lighting.setSpotLightConeAngles(this._lightId, this._innerAngle, this._outerAngle);
		}
	}

	_SetRange(range: number): void
	{
		this._range = range;
		const Lighting = getLightingAPI();
		if (Lighting && this._lightId >= 0)
		{
			Lighting.setSpotLightRange(this._lightId, range);
		}
	}

	_SetDirection(x: number, y: number, z: number): void
	{
		this._dirX = x;
		this._dirY = y;
		this._dirZ = z;
		const Lighting = getLightingAPI();
		if (Lighting && this._lightId >= 0 && this._lightType !== LIGHT_TYPE_POINT)
		{
			Lighting.setSpotLightDirection(this._lightId, x, y, z);
		}
	}

	// === Conditions ===

	_IsEnabled(): boolean
	{
		return this._enabled;
	}

	// === Expressions ===

	_LightID(): number
	{
		return this._lightId;
	}

	_Intensity(): number
	{
		return this._intensity;
	}

	_InnerAngle(): number
	{
		return this._innerAngle;
	}

	_OuterAngle(): number
	{
		return this._outerAngle;
	}

	_Range(): number
	{
		return this._range;
	}

	_ColorR(): number
	{
		return Math.round(this._color[0] * 255);
	}

	_ColorG(): number
	{
		return Math.round(this._color[1] * 255);
	}

	_ColorB(): number
	{
		return Math.round(this._color[2] * 255);
	}

	_DirectionX(): number
	{
		return this._dirX;
	}

	_DirectionY(): number
	{
		return this._dirY;
	}

	_DirectionZ(): number
	{
		return this._dirZ;
	}

	// === Save/Load ===

	_saveToJson(): JSONValue
	{
		return {
			"lightType": this._lightType,
			"enabled": this._enabled,
			"color": this._color as unknown as JSONValue,
			"intensity": this._intensity,
			"innerAngle": this._innerAngle,
			"outerAngle": this._outerAngle,
			"range": this._range,
			"dirX": this._dirX,
			"dirY": this._dirY,
			"dirZ": this._dirZ
		};
	}

	_loadFromJson(o: JSONValue): void
	{
		const data = o as Record<string, unknown>;
		this._lightType = (data["lightType"] as string) ?? LIGHT_TYPE_SPOT;
		this._enabled = data["enabled"] as boolean;
		this._color = data["color"] as unknown as [number, number, number];
		this._intensity = data["intensity"] as number;
		this._innerAngle = data["innerAngle"] as number;
		this._outerAngle = data["outerAngle"] as number;
		this._range = data["range"] as number;
		this._dirX = (data["dirX"] as number) ?? 1;
		this._dirY = (data["dirY"] as number) ?? 0;
		this._dirZ = (data["dirZ"] as number) ?? 0;
		// Force full update on next tick
		this._needsUpdate = true;
	}
};

export type SDKInstanceClass = InstanceType<typeof C3.Plugins.GltfSpotlight.Instance>;
