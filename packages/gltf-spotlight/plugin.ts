const PLUGIN_ID = "GltfSpotlight";
const PLUGIN_CATEGORY: PluginInfoCategory = "3d";

const PLUGIN_CLASS = SDK.Plugins.GltfSpotlight = class GltfSpotlightPlugin extends SDK.IPluginBase
{
	constructor()
	{
		super(PLUGIN_ID);

		SDK.Lang.PushContext("plugins." + PLUGIN_ID.toLowerCase());

		this._info.SetName(globalThis.lang(".name"));
		this._info.SetDescription(globalThis.lang(".description"));
		this._info.SetCategory(PLUGIN_CATEGORY);
		this._info.SetAuthor("Mikal");
		this._info.SetHelpUrl(globalThis.lang(".help-url"));
		this._info.SetPluginType("world");
		this._info.SetIsResizable(false);
		this._info.SetIsRotatable(true);
		this._info.SetHasImage(false);
		this._info.SetSupportsEffects(false);
		this._info.SetMustPreDraw(false);
		this._info.SetIs3D(true);
		this._info.SetSupportsZElevation(true);

		SDK.Lang.PushContext(".properties");

		this._info.SetProperties([
			new SDK.PluginProperty("check", "enabled", true),
			new SDK.PluginProperty("color", "color", [255, 255, 255]),
			new SDK.PluginProperty("float", "intensity", 1.0),
			new SDK.PluginProperty("float", "inner-angle", 15),
			new SDK.PluginProperty("float", "outer-angle", 30),
			new SDK.PluginProperty("float", "range", 10000),
			new SDK.PluginProperty("float", "dir-x", 1),
			new SDK.PluginProperty("float", "dir-y", 0),
			new SDK.PluginProperty("float", "dir-z", 0)
		]);

		SDK.Lang.PopContext();
		SDK.Lang.PopContext();
	}
};

PLUGIN_CLASS.Register(PLUGIN_ID, PLUGIN_CLASS);
