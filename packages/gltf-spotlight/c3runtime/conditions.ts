import type { SDKInstanceClass } from "./instance.ts";

C3.Plugins.GltfSpotlight.Cnds =
{
	IsEnabled(this: SDKInstanceClass): boolean
	{
		return this._IsEnabled();
	}
};

export {}
