import type { SDKInstanceClass } from "./instance.ts";

C3.Plugins.GltfEnvironment.Exps =
{
	AmbientIntensity(this: SDKInstanceClass): number
	{
		return this._AmbientIntensity();
	},

	AmbientColorR(this: SDKInstanceClass): number
	{
		return this._AmbientColorR();
	},

	AmbientColorG(this: SDKInstanceClass): number
	{
		return this._AmbientColorG();
	},

	AmbientColorB(this: SDKInstanceClass): number
	{
		return this._AmbientColorB();
	},

	HemisphereIntensity(this: SDKInstanceClass): number
	{
		return this._HemisphereIntensity();
	},

	SkyColorR(this: SDKInstanceClass): number
	{
		return this._SkyColorR();
	},

	SkyColorG(this: SDKInstanceClass): number
	{
		return this._SkyColorG();
	},

	SkyColorB(this: SDKInstanceClass): number
	{
		return this._SkyColorB();
	},

	GroundColorR(this: SDKInstanceClass): number
	{
		return this._GroundColorR();
	},

	GroundColorG(this: SDKInstanceClass): number
	{
		return this._GroundColorG();
	},

	GroundColorB(this: SDKInstanceClass): number
	{
		return this._GroundColorB();
	},

	ColorBlendMode(this: SDKInstanceClass): string
	{
		return this._ColorBlendMode();
	}
};

export {}
