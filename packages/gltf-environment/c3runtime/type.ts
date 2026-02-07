import type { SDKInstanceClass } from "./instance.ts";

C3.Plugins.GltfEnvironment.Type = class GltfEnvironmentType extends (ISDKObjectTypeBase as new () => ISDKObjectTypeBase_<SDKInstanceClass>)
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
