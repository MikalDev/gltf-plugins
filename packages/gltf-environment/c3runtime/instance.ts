// Lighting API type (exposed by glTF Static via globalThis.GltfBundle.Lighting)
interface LightingAPI {
	setAmbientLight(r: number, g: number, b: number): void;
	setHemisphereLightEnabled(enabled: boolean): void;
	setHemisphereLightSkyColor(r: number, g: number, b: number): void;
	setHemisphereLightGroundColor(r: number, g: number, b: number): void;
	setHemisphereLightIntensity(intensity: number): void;
}

declare global {
	var GltfBundle: {
		Lighting: LightingAPI;
	} | undefined;
}

// Property indices matching plugin.ts order
const PROP_AMBIENT_COLOR = 0;
const PROP_AMBIENT_INTENSITY = 1;
const PROP_HEMISPHERE_ENABLED = 2;
const PROP_SKY_COLOR = 3;
const PROP_GROUND_COLOR = 4;
const PROP_HEMISPHERE_INTENSITY = 5;

/**
 * Get the Lighting API if available (glTF Static loaded)
 */
function getLightingAPI(): LightingAPI | undefined {
	return globalThis.GltfBundle?.Lighting;
}

C3.Plugins.GltfEnvironment.Instance = class GltfEnvironmentInstance extends ISDKWorldInstanceBase
{
	_ambientColor: [number, number, number] = [1, 1, 1];
	_ambientIntensity: number = 0.3;
	_hemisphereEnabled: boolean = true;
	_skyColor: [number, number, number] = [0.53, 0.81, 0.92];
	_groundColor: [number, number, number] = [0.55, 0.27, 0.07];
	_hemisphereIntensity: number = 0.5;
	_needsUpdate: boolean = true;

	constructor()
	{
		super();

		const properties = this._getInitProperties();
		if (properties)
		{
			// Colors come as [r, g, b] array already in 0-1 range (SDK v2)
			this._ambientColor = properties[PROP_AMBIENT_COLOR] as unknown as [number, number, number];
			this._ambientIntensity = properties[PROP_AMBIENT_INTENSITY] as number;
			this._hemisphereEnabled = properties[PROP_HEMISPHERE_ENABLED] as boolean;
			this._skyColor = properties[PROP_SKY_COLOR] as unknown as [number, number, number];
			this._groundColor = properties[PROP_GROUND_COLOR] as unknown as [number, number, number];
			this._hemisphereIntensity = properties[PROP_HEMISPHERE_INTENSITY] as number;
		}

		this._updateGlobalEnvironment();

		// Enable ticking so _tick() is called each frame
		this._setTicking(true);
	}

	_release(): void
	{
		// Stop ticking
		this._setTicking(false);

		const Lighting = getLightingAPI();
		if (Lighting)
		{
			// Reset to defaults
			Lighting.setAmbientLight(0.2, 0.2, 0.2);
			Lighting.setHemisphereLightEnabled(false);
		}

		super._release();
	}

	_updateGlobalEnvironment(): void
	{
		const Lighting = getLightingAPI();
		if (!Lighting)
		{
			// API not available yet, mark that we need to retry
			this._needsUpdate = true;
			return;
		}

		// Successfully applied update
		this._needsUpdate = false;

		// Update ambient light (color * intensity)
		const ar = this._ambientColor[0] * this._ambientIntensity;
		const ag = this._ambientColor[1] * this._ambientIntensity;
		const ab = this._ambientColor[2] * this._ambientIntensity;
		Lighting.setAmbientLight(ar, ag, ab);

		// Update hemisphere light
		Lighting.setHemisphereLightEnabled(this._hemisphereEnabled);
		Lighting.setHemisphereLightSkyColor(this._skyColor[0], this._skyColor[1], this._skyColor[2]);
		Lighting.setHemisphereLightGroundColor(this._groundColor[0], this._groundColor[1], this._groundColor[2]);
		Lighting.setHemisphereLightIntensity(this._hemisphereIntensity);
	}

	_tick(): void
	{
		// Keep trying to apply updates until successful
		if (this._needsUpdate)
		{
			this._updateGlobalEnvironment();
		}
	}

	// === Actions ===

	_SetAmbientColor(r: number, g: number, b: number): void
	{
		this._ambientColor = [r / 255, g / 255, b / 255];
		this._needsUpdate = true;
		this._updateGlobalEnvironment();
	}

	_SetAmbientIntensity(intensity: number): void
	{
		this._ambientIntensity = intensity;
		this._needsUpdate = true;
		this._updateGlobalEnvironment();
	}

	_SetHemisphereEnabled(enabled: number): void
	{
		this._hemisphereEnabled = (enabled === 1);
		this._needsUpdate = true;
		this._updateGlobalEnvironment();
	}

	_SetSkyColor(r: number, g: number, b: number): void
	{
		this._skyColor = [r / 255, g / 255, b / 255];
		this._needsUpdate = true;
		this._updateGlobalEnvironment();
	}

	_SetGroundColor(r: number, g: number, b: number): void
	{
		this._groundColor = [r / 255, g / 255, b / 255];
		this._needsUpdate = true;
		this._updateGlobalEnvironment();
	}

	_SetHemisphereIntensity(intensity: number): void
	{
		this._hemisphereIntensity = intensity;
		this._needsUpdate = true;
		this._updateGlobalEnvironment();
	}

	// === Conditions ===

	_IsHemisphereEnabled(): boolean
	{
		return this._hemisphereEnabled;
	}

	// === Expressions ===

	_AmbientIntensity(): number
	{
		return this._ambientIntensity;
	}

	_AmbientColorR(): number
	{
		return Math.round(this._ambientColor[0] * 255);
	}

	_AmbientColorG(): number
	{
		return Math.round(this._ambientColor[1] * 255);
	}

	_AmbientColorB(): number
	{
		return Math.round(this._ambientColor[2] * 255);
	}

	_HemisphereIntensity(): number
	{
		return this._hemisphereIntensity;
	}

	_SkyColorR(): number
	{
		return Math.round(this._skyColor[0] * 255);
	}

	_SkyColorG(): number
	{
		return Math.round(this._skyColor[1] * 255);
	}

	_SkyColorB(): number
	{
		return Math.round(this._skyColor[2] * 255);
	}

	_GroundColorR(): number
	{
		return Math.round(this._groundColor[0] * 255);
	}

	_GroundColorG(): number
	{
		return Math.round(this._groundColor[1] * 255);
	}

	_GroundColorB(): number
	{
		return Math.round(this._groundColor[2] * 255);
	}

	// === Save/Load ===

	_saveToJson(): JSONValue
	{
		return {
			"ambientColor": this._ambientColor as unknown as JSONValue,
			"ambientIntensity": this._ambientIntensity,
			"hemisphereEnabled": this._hemisphereEnabled,
			"skyColor": this._skyColor as unknown as JSONValue,
			"groundColor": this._groundColor as unknown as JSONValue,
			"hemisphereIntensity": this._hemisphereIntensity
		};
	}

	_loadFromJson(o: JSONValue): void
	{
		const data = o as Record<string, unknown>;
		this._ambientColor = data["ambientColor"] as unknown as [number, number, number];
		this._ambientIntensity = data["ambientIntensity"] as number;
		this._hemisphereEnabled = data["hemisphereEnabled"] as boolean;
		this._skyColor = data["skyColor"] as unknown as [number, number, number];
		this._groundColor = data["groundColor"] as unknown as [number, number, number];
		this._hemisphereIntensity = data["hemisphereIntensity"] as number;
		this._updateGlobalEnvironment();
	}
};

export type SDKInstanceClass = InstanceType<typeof C3.Plugins.GltfEnvironment.Instance>;
