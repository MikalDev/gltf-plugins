"use strict";

const C3 = globalThis.C3;

// Property indices matching plugin.ts order
const PROP_ENABLED = 0;
const PROP_COLOR = 1;
const PROP_INTENSITY = 2;
const PROP_INNER_ANGLE = 3;
const PROP_OUTER_ANGLE = 4;
const PROP_RANGE = 5;

/**
 * Get the Lighting API if available (glTF Static loaded)
 */
function getLightingAPI() {
	return globalThis.GltfBundle?.Lighting;
}

C3.Plugins.GltfSpotlight.Instance = class GltfSpotlightInstance extends C3.SDKWorldInstanceBase
{
	constructor(inst, properties)
	{
		super(inst);

		this._lightId = -1;

		// Initialize from properties
		if (properties)
		{
			this._enabled = properties[PROP_ENABLED];
			this._color = properties[PROP_COLOR]; // [r, g, b] 0-1 range
			this._intensity = properties[PROP_INTENSITY];
			this._innerAngle = properties[PROP_INNER_ANGLE];
			this._outerAngle = properties[PROP_OUTER_ANGLE];
			this._range = properties[PROP_RANGE];
		}
		else
		{
			this._enabled = true;
			this._color = [1, 1, 1];
			this._intensity = 1;
			this._innerAngle = 15;
			this._outerAngle = 30;
			this._range = 0;
		}

		this._createSpotLight();
	}

	Release()
	{
		const Lighting = getLightingAPI();
		if (Lighting && this._lightId >= 0)
		{
			Lighting.removeSpotLight(this._lightId);
		}

		super.Release();
	}

	_createSpotLight()
	{
		const Lighting = getLightingAPI();
		if (!Lighting) return;  // glTF Static not loaded yet

		const wi = this.GetWorldInfo();
		const angle = wi.GetAngle();

		// Create spotlight using Lighting API
		this._lightId = Lighting.createSpotLight(
			wi.GetX(), wi.GetY(), wi.GetZElevation(),
			Math.cos(angle), Math.sin(angle), 0,
			this._innerAngle, this._outerAngle,
			1.0,  // falloffExponent
			this._range
		);

		// Set additional properties
		Lighting.setSpotLightEnabled(this._lightId, this._enabled);
		Lighting.setSpotLightColor(this._lightId, this._color[0], this._color[1], this._color[2]);
		Lighting.setSpotLightIntensity(this._lightId, this._intensity);
	}

	_updateSpotLight()
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
			this._createSpotLight();
			return;
		}

		const wi = this.GetWorldInfo();
		const angle = wi.GetAngle();

		// Update via Lighting API
		Lighting.setSpotLightEnabled(this._lightId, this._enabled);
		Lighting.setSpotLightColor(this._lightId, this._color[0], this._color[1], this._color[2]);
		Lighting.setSpotLightIntensity(this._lightId, this._intensity);
		Lighting.setSpotLightPosition(this._lightId, wi.GetX(), wi.GetY(), wi.GetZElevation());
		Lighting.setSpotLightDirection(this._lightId, Math.cos(angle), Math.sin(angle), 0);
		Lighting.setSpotLightConeAngles(this._lightId, this._innerAngle, this._outerAngle);
		Lighting.setSpotLightRange(this._lightId, this._range);
	}

	Tick()
	{
		// Update position/angle each tick in case instance moved
		this._updateSpotLight();
	}

	// === Actions ===

	_SetEnabled(enabled)
	{
		this._enabled = (enabled === 1);
		const Lighting = getLightingAPI();
		if (Lighting && this._lightId >= 0)
		{
			Lighting.setSpotLightEnabled(this._lightId, this._enabled);
		}
	}

	_SetColor(r, g, b)
	{
		this._color = [r / 255, g / 255, b / 255];
		const Lighting = getLightingAPI();
		if (Lighting && this._lightId >= 0)
		{
			Lighting.setSpotLightColor(this._lightId, this._color[0], this._color[1], this._color[2]);
		}
	}

	_SetIntensity(intensity)
	{
		this._intensity = intensity;
		const Lighting = getLightingAPI();
		if (Lighting && this._lightId >= 0)
		{
			Lighting.setSpotLightIntensity(this._lightId, intensity);
		}
	}

	_SetInnerAngle(angle)
	{
		this._innerAngle = angle;
		const Lighting = getLightingAPI();
		if (Lighting && this._lightId >= 0)
		{
			Lighting.setSpotLightConeAngles(this._lightId, this._innerAngle, this._outerAngle);
		}
	}

	_SetOuterAngle(angle)
	{
		this._outerAngle = angle;
		const Lighting = getLightingAPI();
		if (Lighting && this._lightId >= 0)
		{
			Lighting.setSpotLightConeAngles(this._lightId, this._innerAngle, this._outerAngle);
		}
	}

	_SetRange(range)
	{
		this._range = range;
		const Lighting = getLightingAPI();
		if (Lighting && this._lightId >= 0)
		{
			Lighting.setSpotLightRange(this._lightId, range);
		}
	}

	// === Conditions ===

	_IsEnabled()
	{
		return this._enabled;
	}

	// === Expressions ===

	_LightID()
	{
		return this._lightId;
	}

	_Intensity()
	{
		return this._intensity;
	}

	_InnerAngle()
	{
		return this._innerAngle;
	}

	_OuterAngle()
	{
		return this._outerAngle;
	}

	_Range()
	{
		return this._range;
	}

	_ColorR()
	{
		return Math.round(this._color[0] * 255);
	}

	_ColorG()
	{
		return Math.round(this._color[1] * 255);
	}

	_ColorB()
	{
		return Math.round(this._color[2] * 255);
	}

	// === Save/Load ===

	SaveToJson()
	{
		return {
			"enabled": this._enabled,
			"color": this._color,
			"intensity": this._intensity,
			"innerAngle": this._innerAngle,
			"outerAngle": this._outerAngle,
			"range": this._range
		};
	}

	LoadFromJson(o)
	{
		this._enabled = o["enabled"];
		this._color = o["color"];
		this._intensity = o["intensity"];
		this._innerAngle = o["innerAngle"];
		this._outerAngle = o["outerAngle"];
		this._range = o["range"];
		this._updateSpotLight();
	}
};
