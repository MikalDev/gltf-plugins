const PLUGIN_CLASS = SDK.Plugins.GltfSpotlight;

PLUGIN_CLASS.Type = class GltfSpotlightType extends SDK.ITypeBase
{
	constructor(sdkPlugin: SDK.IPluginBase, iObjectType: SDK.IObjectType)
	{
		super(sdkPlugin, iObjectType);
	}
};

export {}
