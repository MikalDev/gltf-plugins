import type { SDKInstanceClass } from "./instance.ts";

C3.Plugins.GltfEnvironment.Cnds =
{
	IsHemisphereEnabled(this: SDKInstanceClass): boolean
	{
		return this._IsHemisphereEnabled();
	}
};

export {}
