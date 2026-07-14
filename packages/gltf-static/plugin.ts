import type { SDKEditorInstanceClass } from "./instance.ts";

const PLUGIN_ID = "GltfStatic";
const PLUGIN_CATEGORY: PluginInfoCategory = "3d";

const PLUGIN_CLASS = SDK.Plugins.GltfStatic = class GltfStaticPlugin extends SDK.IPluginBase
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
		this._info.SetIsResizable(true);
		this._info.SetIsRotatable(true);
		this._info.SetHasImage(true);
		this._info.SetSupportsEffects(true);
		this._info.SetMustPreDraw(false);
		this._info.SetIs3D(true);
		this._info.SetSupportsZElevation(true);
		// Show C3's common 3D-rotation parameter/gizmo in the editor (as the
		// built-in 3D Model plugin does). Rotation is stored on the instance's
		// built-in 3D rotation, which the runtime already reads via getQuaternion().
		this._info.SetIsRotatable3D(true);
		this._info.SetRuntimeModuleMainScript("c3runtime/main.js");
		this._info.AddC3RuntimeScript("c3runtime/builtin-models.js");
		this._info.AddC3RuntimeScript("c3runtime/gltf-bundle.js");
		this._info.AddCommonPositionACEs();
		this._info.AddCommonSceneGraphACEs();
		this._info.AddCommonZOrderACEs();
		// r490: adopt C3's built-in 3D rotation as the source of truth. Adds the
		// standard "Set Euler rotation"/quaternion ACEs and lets behaviors
		// (Billboard, physics, Tween, timelines) drive the model's rotation. The
		// runtime reads this via getQuaternion(); the legacy rotation-x/y/z
		// properties remain as initial-rotation seeds for back-compat.
		this._info.AddCommon3DRotationACEs();

		SDK.Lang.PushContext(".properties");

		this._info.SetProperties([
			new SDK.PluginProperty("link", "edit-image", {
				linkCallback: (param: SDK.IWorldInstanceBase | SDK.ITypeBase) => {
					const sdkType = param as SDK.ITypeBase;
					sdkType.GetObjectType().EditImage();
				},
				callbackType: "once-for-type"
			}),
			new SDK.PluginProperty("link", "make-original-size", {
				linkCallback: (param: SDK.IWorldInstanceBase | SDK.ITypeBase) => {
					const sdkInst = param as SDKEditorInstanceClass;
					sdkInst.OnMakeOriginalSize();
				},
				callbackType: "for-each-instance"
			}),
			new SDK.PluginProperty("text", "model-url", ""),
			new SDK.PluginProperty("projectfile", "model-file", {
				filter: "gltf,glb"
			}),
			new SDK.PluginProperty("float", "rotation-x", 0),
			new SDK.PluginProperty("float", "rotation-y", 0),
			new SDK.PluginProperty("float", "rotation-z", 0),
			new SDK.PluginProperty("float", "scale", 1),
			new SDK.PluginProperty("check", "use-built-in-model", false),
			new SDK.PluginProperty("combo", "built-in-model-type", {
				items: ["cube", "sphere", "capsule", "cylinder", "cone", "ramp", "plane"],
				initialValue: "cube"
			}),
			new SDK.PluginProperty("float", "bbox-scale", 1),
			new SDK.PluginProperty("check", "convert-axes", true)
		]);

		SDK.Lang.PopContext();
		SDK.Lang.PopContext();
	}
};

PLUGIN_CLASS.Register(PLUGIN_ID, PLUGIN_CLASS);
