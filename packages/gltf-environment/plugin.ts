const PLUGIN_ID = "GltfEnvironment";
const PLUGIN_CATEGORY: PluginInfoCategory = "3d";

const PLUGIN_CLASS = SDK.Plugins.GltfEnvironment = class GltfEnvironmentPlugin extends SDK.IPluginBase
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
		this._info.SetIsRotatable(false);
		this._info.SetHasImage(false);
		this._info.SetSupportsEffects(false);
		this._info.SetMustPreDraw(false);
		this._info.SetIs3D(false);
		this._info.SetSupportsZElevation(false);
		this._info.SetIsSingleGlobal(false);

		SDK.Lang.PushContext(".properties");

		// Color properties use 0-255 range in definition, SDK normalizes to 0-1 at runtime
		this._info.SetProperties([
			new SDK.PluginProperty("color", "ambient-color", [255, 255, 255]),
			new SDK.PluginProperty("float", "ambient-intensity", 0.3),
			new SDK.PluginProperty("check", "hemisphere-enabled", true),
			new SDK.PluginProperty("color", "sky-color", [135, 206, 235]),      // Sky blue
			new SDK.PluginProperty("color", "ground-color", [139, 69, 19]),     // Brown
			new SDK.PluginProperty("float", "hemisphere-intensity", 0.5)
		]);

		SDK.Lang.PopContext();
		SDK.Lang.PopContext();
	}
};

PLUGIN_CLASS.Register(PLUGIN_ID, PLUGIN_CLASS);
