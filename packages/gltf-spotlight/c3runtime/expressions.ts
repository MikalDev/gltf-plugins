import type { SDKInstanceClass } from "./instance.ts";

C3.Plugins.GltfSpotlight.Exps =
{
	LightID(this: SDKInstanceClass): number
	{
		return this._LightID();
	},

	Intensity(this: SDKInstanceClass): number
	{
		return this._Intensity();
	},

	InnerAngle(this: SDKInstanceClass): number
	{
		return this._InnerAngle();
	},

	OuterAngle(this: SDKInstanceClass): number
	{
		return this._OuterAngle();
	},

	Range(this: SDKInstanceClass): number
	{
		return this._Range();
	},

	ColorR(this: SDKInstanceClass): number
	{
		return this._ColorR();
	},

	ColorG(this: SDKInstanceClass): number
	{
		return this._ColorG();
	},

	ColorB(this: SDKInstanceClass): number
	{
		return this._ColorB();
	},

	DirectionX(this: SDKInstanceClass): number
	{
		return this._DirectionX();
	},

	DirectionY(this: SDKInstanceClass): number
	{
		return this._DirectionY();
	},

	DirectionZ(this: SDKInstanceClass): number
	{
		return this._DirectionZ();
	}
};

export {}
