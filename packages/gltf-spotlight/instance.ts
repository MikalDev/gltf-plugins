import type { EditorSpotlight } from "@gltf-plugins/shared-types";

const PLUGIN_CLASS = SDK.Plugins.GltfSpotlight;

// Property IDs matching plugin.ts order
const PROP_LIGHT_TYPE = "light-type";
const PROP_ENABLED = "enabled";
const PROP_COLOR = "color";
const PROP_INTENSITY = "intensity";
const PROP_INNER_ANGLE = "inner-angle";
const PROP_OUTER_ANGLE = "outer-angle";
const PROP_RANGE = "range";
const PROP_DIR_X = "dir-x";
const PROP_DIR_Y = "dir-y";
const PROP_DIR_Z = "dir-z";

const COMBO_LIGHT_TYPE_SPOT  = 0;
const COMBO_LIGHT_TYPE_POINT = 1;

const DEG_TO_RAD = Math.PI / 180;

// Unique ID counter for spotlight instances
let spotlightIdCounter = 0;

PLUGIN_CLASS.Instance = class GltfSpotlightInstance extends SDK.IWorldInstanceBase
{
	private _uniqueId: number;

	constructor(sdkType: SDK.ITypeBase, inst: SDK.IWorldInstance)
	{
		super(sdkType, inst);
		this._uniqueId = ++spotlightIdCounter;
	}

	OnCreate(): void
	{
		this._updateGlobalSpotlight();
	}

	OnPlacedInLayout(): void
	{
		this._updateGlobalSpotlight();
	}

	Release(): void
	{
		// Remove this spotlight from the global array and mark lighting as dirty
		const arr = globalThis.gltfEditorSpotlights ?? [];
		globalThis.gltfEditorSpotlights = arr.filter(s => s.id !== this._uniqueId);
		globalThis.gltfEditorLightingVersion = (globalThis.gltfEditorLightingVersion || 0) + 1;
	}

	OnPropertyChanged(id: string, value: EditorPropertyValueType): void
	{
		this._updateGlobalSpotlight();
	}

	Draw(iRenderer: SDK.Gfx.IWebGLRenderer, iDrawParams: SDK.Gfx.IDrawParams): void
	{
		// Update spotlight data each draw in case position/elevation changed
		this._updateGlobalSpotlight();

		const x = this._inst.GetX();
		const y = this._inst.GetY();

		// Get properties
		const lightTypeIdx = this._inst.GetPropertyValue(PROP_LIGHT_TYPE) as number;
		const isPoint = lightTypeIdx === COMBO_LIGHT_TYPE_POINT;
		const enabled = this._inst.GetPropertyValue(PROP_ENABLED) as boolean;
		const color = this._inst.GetPropertyValue(PROP_COLOR) as SDK.Color;

		// Get color components (0-1 range)
		const r = color.getR();
		const g = color.getG();
		const b = color.getB();

		// Draw light icon - a square
		const size = 32;

		iRenderer.SetColorFillMode();

		// Set color based on enabled state
		if (enabled) {
			iRenderer.SetColorRgba(r, g, b, 1);
		} else {
			iRenderer.SetColorRgba(0.5, 0.5, 0.5, 0.5);
		}

		// Draw the light source as a square
		iRenderer.Rect2(x - size / 2, y - size / 2, x + size / 2, y + size / 2);

		iRenderer.SetSmoothLineFillMode();
		iRenderer.PushLineWidth(3);
		if (enabled) {
			iRenderer.SetColorRgba(r, g, b, 0.7);
		} else {
			iRenderer.SetColorRgba(0.5, 0.5, 0.5, 0.3);
		}

		if (isPoint)
		{
			// Draw 8-ray omnidirectional gizmo for point light
			const rayLength = 48;
			for (let i = 0; i < 8; i++)
			{
				const angle = (i / 8) * Math.PI * 2;
				const rx = Math.cos(angle) * rayLength;
				const ry = Math.sin(angle) * rayLength;
				iRenderer.Line(x, y, x + rx, y + ry);
			}
		}
		else
		{
			// Draw the cone direction using direction properties (X/Y plane)
			const outerAngle = this._inst.GetPropertyValue(PROP_OUTER_ANGLE) as number;
			const dirX = this._inst.GetPropertyValue(PROP_DIR_X) as number;
			const dirY = this._inst.GetPropertyValue(PROP_DIR_Y) as number;
			const coneLength = 64;
			const halfAngle = outerAngle * DEG_TO_RAD / 2;
			// Normalize direction for drawing
			const dirLen = Math.sqrt(dirX * dirX + dirY * dirY);
			const normX = dirLen > 0 ? dirX / dirLen : 1;
			const normY = dirLen > 0 ? dirY / dirLen : 0;

			// Center point of cone end
			const endX = x + normX * coneLength;
			const endY = y + normY * coneLength;

			// Perpendicular offset for cone edges
			const perpX = -normY * Math.tan(halfAngle) * coneLength;
			const perpY = normX * Math.tan(halfAngle) * coneLength;

			iRenderer.Line(x, y, endX + perpX, endY + perpY);
			iRenderer.Line(x, y, endX - perpX, endY - perpY);
			iRenderer.Line(endX + perpX, endY + perpY, endX - perpX, endY - perpY);
		}

		iRenderer.PopLineWidth();

		// Draw orange wireframe box outline around icon (Unity/Unreal style gizmo color)
		iRenderer.PushLineWidth(2);
		const outlineColor = enabled ? { r: 1.0, g: 0.55, b: 0.0, a: 1.0 } : { r: 0.6, g: 0.4, b: 0.2, a: 0.5 };
		iRenderer.SetColorRgba(outlineColor.r, outlineColor.g, outlineColor.b, outlineColor.a);
		const boxPadding = 4;
		const boxLeft = x - size / 2 - boxPadding;
		const boxRight = x + size / 2 + boxPadding;
		const boxTop = y - size / 2 - boxPadding;
		const boxBottom = y + size / 2 + boxPadding;
		// Draw box outline (4 lines)
		iRenderer.Line(boxLeft, boxTop, boxRight, boxTop);       // top
		iRenderer.Line(boxRight, boxTop, boxRight, boxBottom);   // right
		iRenderer.Line(boxRight, boxBottom, boxLeft, boxBottom); // bottom
		iRenderer.Line(boxLeft, boxBottom, boxLeft, boxTop);     // left
		iRenderer.PopLineWidth();
	}

	private _updateGlobalSpotlight(): void
	{
		const arr = globalThis.gltfEditorSpotlights ?? [];

		// Remove existing entry for this instance
		const idx = arr.findIndex(s => s.id === this._uniqueId);
		if (idx >= 0) arr.splice(idx, 1);

		const enabled = this._inst.GetPropertyValue(PROP_ENABLED) as boolean;

		if (enabled) {
			const lightTypeIdx = this._inst.GetPropertyValue(PROP_LIGHT_TYPE) as number;
			const lightType = lightTypeIdx === COMBO_LIGHT_TYPE_POINT ? "point" : "spot";
			const color = this._inst.GetPropertyValue(PROP_COLOR) as SDK.Color;
			const dirX = this._inst.GetPropertyValue(PROP_DIR_X) as number;
			const dirY = this._inst.GetPropertyValue(PROP_DIR_Y) as number;
			const dirZ = this._inst.GetPropertyValue(PROP_DIR_Z) as number;

			arr.push({
				id: this._uniqueId,
				enabled: true,
				type: lightType,
				position: [this._inst.GetX(), this._inst.GetY(), this._inst.GetZElevation()],
				direction: [dirX, dirY, dirZ],
				color: [color.getR(), color.getG(), color.getB()],
				intensity: this._inst.GetPropertyValue(PROP_INTENSITY) as number,
				innerAngle: this._inst.GetPropertyValue(PROP_INNER_ANGLE) as number,
				outerAngle: this._inst.GetPropertyValue(PROP_OUTER_ANGLE) as number,
				range: this._inst.GetPropertyValue(PROP_RANGE) as number
			});
		}

		globalThis.gltfEditorSpotlights = arr;

		// Mark lighting as dirty so gltf-static knows to update
		globalThis.gltfEditorLightingVersion = (globalThis.gltfEditorLightingVersion || 0) + 1;
	}
};

export type SDKEditorInstanceClass = InstanceType<typeof PLUGIN_CLASS.Instance>;
