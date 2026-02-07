const PLUGIN_CLASS = SDK.Plugins.GltfEnvironment;

PLUGIN_CLASS.Type = class GltfEnvironmentType extends SDK.ITypeBase
{
	constructor(sdkPlugin: SDK.IPluginBase, iObjectType: SDK.IObjectType)
	{
		super(sdkPlugin, iObjectType);
	}
};

export {}
