import type { SDKInstanceClass } from "./instance.ts";

C3.Plugins.GltfEnvironment.Acts =
{
	SetAmbientColor(this: SDKInstanceClass, r: number, g: number, b: number): void
	{
		this._SetAmbientColor(r, g, b);
	},

	SetAmbientIntensity(this: SDKInstanceClass, intensity: number): void
	{
		this._SetAmbientIntensity(intensity);
	},

	SetHemisphereEnabled(this: SDKInstanceClass, enabled: number): void
	{
		this._SetHemisphereEnabled(enabled);
	},

	SetSkyColor(this: SDKInstanceClass, r: number, g: number, b: number): void
	{
		this._SetSkyColor(r, g, b);
	},

	SetGroundColor(this: SDKInstanceClass, r: number, g: number, b: number): void
	{
		this._SetGroundColor(r, g, b);
	},

	SetHemisphereIntensity(this: SDKInstanceClass, intensity: number): void
	{
		this._SetHemisphereIntensity(intensity);
	}
};

export {}
