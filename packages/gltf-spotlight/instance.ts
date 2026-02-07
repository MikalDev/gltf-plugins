import type { EditorSpotlight } from "@gltf-plugins/shared-types";

const PLUGIN_CLASS = SDK.Plugins.GltfSpotlight;

// Property IDs matching plugin.ts order
const PROP_ENABLED = "enabled";
const PROP_COLOR = "color";
const PROP_INTENSITY = "intensity";
const PROP_INNER_ANGLE = "inner-angle";
const PROP_OUTER_ANGLE = "outer-angle";
const PROP_RANGE = "range";

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
		// Remove this spotlight from the global array
		const arr = globalThis.gltfEditorSpotlights ?? [];
		globalThis.gltfEditorSpotlights = arr.filter(s => s.id !== this._uniqueId);
	}

	OnPropertyChanged(id: string, value: EditorPropertyValueType): void
	{
		this._updateGlobalSpotlight();
	}

	Draw(iRenderer: SDK.Gfx.IWebGLRenderer, iDrawParams: SDK.Gfx.IDrawParams): void
	{
		const x = this._inst.GetX();
		const y = this._inst.GetY();
		const angle = this._inst.GetAngle();

		// Get properties
		const enabled = this._inst.GetPropertyValue(PROP_ENABLED) as boolean;
		const color = this._inst.GetPropertyValue(PROP_COLOR) as SDK.Color;
		const outerAngle = this._inst.GetPropertyValue(PROP_OUTER_ANGLE) as number;

		// Get color components (0-1 range)
		const r = color.getR();
		const g = color.getG();
		const b = color.getB();

		// Draw spotlight icon - a square with a cone
		const size = 16;
		const coneLength = 40;

		iRenderer.SetColorFillMode();

		// Set color based on enabled state
		if (enabled) {
			iRenderer.SetColorRgba(r, g, b, 1);
		} else {
			iRenderer.SetColorRgba(0.5, 0.5, 0.5, 0.5);
		}

		// Draw the light source as a square
		iRenderer.Rect2(x - size / 2, y - size / 2, x + size / 2, y + size / 2);

		// Draw the cone direction
		const halfAngle = outerAngle * DEG_TO_RAD / 2;
		const cosA = Math.cos(angle);
		const sinA = Math.sin(angle);

		// Center point of cone end
		const endX = x + cosA * coneLength;
		const endY = y + sinA * coneLength;

		// Perpendicular offset for cone edges
		const perpX = -sinA * Math.tan(halfAngle) * coneLength;
		const perpY = cosA * Math.tan(halfAngle) * coneLength;

		// Draw cone edges using smooth line mode
		iRenderer.SetSmoothLineFillMode();
		if (enabled) {
			iRenderer.SetColorRgba(r, g, b, 0.7);
		} else {
			iRenderer.SetColorRgba(0.5, 0.5, 0.5, 0.3);
		}
		iRenderer.Line(x, y, endX + perpX, endY + perpY);
		iRenderer.Line(x, y, endX - perpX, endY - perpY);
		iRenderer.Line(endX + perpX, endY + perpY, endX - perpX, endY - perpY);
	}

	private _updateGlobalSpotlight(): void
	{
		const arr = globalThis.gltfEditorSpotlights ?? [];

		// Remove existing entry for this instance
		const idx = arr.findIndex(s => s.id === this._uniqueId);
		if (idx >= 0) arr.splice(idx, 1);

		const enabled = this._inst.GetPropertyValue(PROP_ENABLED) as boolean;

		if (enabled) {
			const color = this._inst.GetPropertyValue(PROP_COLOR) as SDK.Color;

			arr.push({
				id: this._uniqueId,
				enabled: true,
				position: [this._inst.GetX(), this._inst.GetY(), this._inst.GetZElevation()],
				direction: this._getDirectionFromAngle(this._inst.GetAngle()),
				color: [color.getR(), color.getG(), color.getB()],
				intensity: this._inst.GetPropertyValue(PROP_INTENSITY) as number,
				innerAngle: this._inst.GetPropertyValue(PROP_INNER_ANGLE) as number,
				outerAngle: this._inst.GetPropertyValue(PROP_OUTER_ANGLE) as number,
				range: this._inst.GetPropertyValue(PROP_RANGE) as number
			});
		}

		globalThis.gltfEditorSpotlights = arr;
	}

	private _getDirectionFromAngle(angle: number): [number, number, number]
	{
		// Convert C3 angle to direction vector
		// C3 angles: 0 = right, 90 = down (clockwise)
		// We use X/Y plane direction, with Z pointing forward into scene
		return [Math.cos(angle), Math.sin(angle), 0];
	}
};

export type SDKEditorInstanceClass = InstanceType<typeof PLUGIN_CLASS.Instance>;
