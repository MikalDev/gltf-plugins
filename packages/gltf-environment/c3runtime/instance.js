"use strict";

const C3 = globalThis.C3;

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
function getLightingAPI() {
	return globalThis.GltfBundle?.Lighting;
}

C3.Plugins.GltfEnvironment.Instance = class GltfEnvironmentInstance extends C3.SDKWorldInstanceBase
{
	constructor(inst, properties)
	{
		super(inst);

		this._needsUpdate = true; // Track if we need to apply an update

		// Initialize from properties
		if (properties)
		{
			this._ambientColor = properties[PROP_AMBIENT_COLOR]; // [r, g, b] 0-1 range
			this._ambientIntensity = properties[PROP_AMBIENT_INTENSITY];
			this._hemisphereEnabled = properties[PROP_HEMISPHERE_ENABLED];
			this._skyColor = properties[PROP_SKY_COLOR]; // [r, g, b] 0-1 range
			this._groundColor = properties[PROP_GROUND_COLOR]; // [r, g, b] 0-1 range
			this._hemisphereIntensity = properties[PROP_HEMISPHERE_INTENSITY];
		}
		else
		{
			this._ambientColor = [1, 1, 1];
			this._ambientIntensity = 0.3;
			this._hemisphereEnabled = true;
			this._skyColor = [0.53, 0.81, 0.92]; // Light blue
			this._groundColor = [0.55, 0.27, 0.07]; // Brown
			this._hemisphereIntensity = 0.5;
		}

		this._updateGlobalEnvironment();
	}

	Release()
	{
		const Lighting = getLightingAPI();
		if (Lighting)
		{
			// Reset to defaults
			Lighting.setAmbientLight(0.2, 0.2, 0.2);
			Lighting.setHemisphereLightEnabled(false);
		}

		super.Release();
	}

	_updateGlobalEnvironment()
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

	Tick()
	{
		// Keep trying to apply updates until successful
		if (this._needsUpdate)
		{
			this._updateGlobalEnvironment();
		}
	}
needsUpdate = true;
		this._updateGlobalEnvironment();
	}

	_SetAmbientIntensity(intensity)
	{
		this._ambientIntensity = intensity;
		this._needsUpdate = true;
		this._updateGlobalEnvironment();
	}

	_SetHemisphereEnabled(enabled)
	{
		this._hemisphereEnabled = (enabled === 1);
		this._needsUpdate = true;
		this._updateGlobalEnvironment();
	}

	_SetSkyColor(r, g, b)
	{
		this._skyColor = [r / 255, g / 255, b / 255];
		this._needsUpdate = true;
		this._updateGlobalEnvironment();
	}

	_SetGroundColor(r, g, b)
	{
		this._groundColor = [r / 255, g / 255, b / 255];
		this._needsUpdate = true;
		this._updateGlobalEnvironment();
	}

	_SetHemisphereIntensity(intensity)
	{
		this._hemisphereIntensity = intensity;
		this._needsUpdate = true;
		this._updateGlobalEnvironment();
	}

	// === Conditions ===

	_IsHemisphereEnabled()
	{
		return this._hemisphereEnabled;
	}

	// === Expressions ===

	_AmbientIntensity()
	{
		return this._ambientIntensity;
	}

	_AmbientColorR()
	{
		return Math.round(this._ambientColor[0] * 255);
	}

	_AmbientColorG()
	{
		return Math.round(this._ambientColor[1] * 255);
	}

	_AmbientColorB()
	{
		return Math.round(this._ambientColor[2] * 255);
	}

	_HemisphereIntensity()
	{
		return this._hemisphereIntensity;
	}

	_SkyColorR()
	{
		return Math.round(this._skyColor[0] * 255);
	}

	_SkyColorG()
	{
		return Math.round(this._skyColor[1] * 255);
	}

	_SkyColorB()
	{
		return Math.round(this._skyColor[2] * 255);
	}

	_GroundColorR()
	{
		return Math.round(this._groundColor[0] * 255);
	}

	_GroundColorG()
	{
		return Math.round(this._groundColor[1] * 255);
	}

	_GroundColorB()
	{
		return Math.round(this._groundColor[2] * 255);
	}

	// === Save/Load ===

	SaveToJson()
	{
		return {
			"ambientColor": this._ambientColor,
			"ambientIntensity": this._ambientIntensity,
			"hemisphereEnabled": this._hemisphereEnabled,
			"skyColor": this._skyColor,
			"groundColor": this._groundColor,
			"hemisphereIntensity": this._hemisphereIntensity
		};
	}

	LoadFromJson(o)
	{
		this._ambientColor = o["ambientColor"];
		this._ambientIntensity = o["ambientIntensity"];
		this._hemisphereEnabled = o["hemisphereEnabled"];
		this._skyColor = o["skyColor"];
		this._groundColor = o["groundColor"];
		this._hemisphereIntensity = o["hemisphereIntensity"];
		this._updateGlobalEnvironment();
	}
};
