import type { EditorEnvironment } from "@gltf-plugins/shared-types";

const PLUGIN_CLASS = SDK.Plugins.GltfEnvironment;

// Property IDs matching plugin.ts order
const PROP_AMBIENT_COLOR = "ambient-color";
const PROP_AMBIENT_INTENSITY = "ambient-intensity";
const PROP_HEMISPHERE_ENABLED = "hemisphere-enabled";
const PROP_SKY_COLOR = "sky-color";
const PROP_GROUND_COLOR = "ground-color";
const PROP_HEMISPHERE_INTENSITY = "hemisphere-intensity";

PLUGIN_CLASS.Instance = class GltfEnvironmentInstance extends SDK.IWorldInstanceBase
{
	constructor(sdkType: SDK.ITypeBase, inst: SDK.IWorldInstance)
	{
		super(sdkType, inst);
	}

	OnCreate(): void
	{
		this._updateGlobalEnvironment();
	}

	OnPlacedInLayout(): void
	{
		this._updateGlobalEnvironment();
	}

	Release(): void
	{
		// Clear the global environment
		globalThis.gltfEditorEnvironment = undefined;
	}

	OnPropertyChanged(id: string, value: EditorPropertyValueType): void
	{
		this._updateGlobalEnvironment();
	}

	Draw(iRenderer: SDK.Gfx.IWebGLRenderer, iDrawParams: SDK.Gfx.IDrawParams): void
	{
		const x = this._inst.GetX();
		const y = this._inst.GetY();

		// Get colors
		const ambientColor = this._inst.GetPropertyValue(PROP_AMBIENT_COLOR) as SDK.Color;
		const hemisphereEnabled = this._inst.GetPropertyValue(PROP_HEMISPHERE_ENABLED) as boolean;
		const skyColor = this._inst.GetPropertyValue(PROP_SKY_COLOR) as SDK.Color;
		const groundColor = this._inst.GetPropertyValue(PROP_GROUND_COLOR) as SDK.Color;

		iRenderer.SetColorFillMode();

		// Draw sun icon as a square
		const sunSize = 14;
		iRenderer.SetColorRgba(ambientColor.getR(), ambientColor.getG(), ambientColor.getB(), 1);
		iRenderer.Rect2(x - sunSize, y - sunSize, x + sunSize, y + sunSize);

		// Draw rays using lines
		iRenderer.SetSmoothLineFillMode();
		const rayLength = 8;
		const rayOffset = sunSize + 4;
		for (let i = 0; i < 8; i++) {
			const angle = (i / 8) * Math.PI * 2;
			const startX = x + Math.cos(angle) * rayOffset;
			const startY = y + Math.sin(angle) * rayOffset;
			const endX = x + Math.cos(angle) * (rayOffset + rayLength);
			const endY = y + Math.sin(angle) * (rayOffset + rayLength);
			iRenderer.Line(startX, startY, endX, endY);
		}

		// Draw hemisphere indicator if enabled
		if (hemisphereEnabled) {
			iRenderer.SetColorFillMode();
			const hemiOffset = 35;

			// Sky bar (top)
			iRenderer.SetColorRgba(skyColor.getR(), skyColor.getG(), skyColor.getB(), 0.7);
			iRenderer.Rect2(x - 20, y - hemiOffset - 8, x + 20, y - hemiOffset);

			// Ground bar (bottom)
			iRenderer.SetColorRgba(groundColor.getR(), groundColor.getG(), groundColor.getB(), 0.7);
			iRenderer.Rect2(x - 20, y + hemiOffset, x + 20, y + hemiOffset + 8);
		}
	}

	private _updateGlobalEnvironment(): void
	{
		const ambientColor = this._inst.GetPropertyValue(PROP_AMBIENT_COLOR) as SDK.Color;
		const skyColor = this._inst.GetPropertyValue(PROP_SKY_COLOR) as SDK.Color;
		const groundColor = this._inst.GetPropertyValue(PROP_GROUND_COLOR) as SDK.Color;

		globalThis.gltfEditorEnvironment = {
			ambientColor: [ambientColor.getR(), ambientColor.getG(), ambientColor.getB()],
			ambientIntensity: this._inst.GetPropertyValue(PROP_AMBIENT_INTENSITY) as number,
			hemisphereEnabled: this._inst.GetPropertyValue(PROP_HEMISPHERE_ENABLED) as boolean,
			skyColor: [skyColor.getR(), skyColor.getG(), skyColor.getB()],
			groundColor: [groundColor.getR(), groundColor.getG(), groundColor.getB()],
			hemisphereIntensity: this._inst.GetPropertyValue(PROP_HEMISPHERE_INTENSITY) as number
		};
	}
};

export type SDKEditorInstanceClass = InstanceType<typeof PLUGIN_CLASS.Instance>;
