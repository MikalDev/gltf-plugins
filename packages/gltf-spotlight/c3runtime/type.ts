import type { SDKInstanceClass } from "./instance.ts";

C3.Plugins.GltfSpotlight.Type = class GltfSpotlightType extends (ISDKObjectTypeBase as new () => ISDKObjectTypeBase_<SDKInstanceClass>)
{
	constructor()
	{
		super();
	}

	_onCreate(): void
	{
	}
};

export {}
