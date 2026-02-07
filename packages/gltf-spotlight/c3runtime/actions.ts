import type { SDKInstanceClass } from "./instance.ts";

C3.Plugins.GltfSpotlight.Acts =
{
	SetEnabled(this: SDKInstanceClass, enabled: number): void
	{
		this._SetEnabled(enabled);
	},

	SetColor(this: SDKInstanceClass, r: number, g: number, b: number): void
	{
		this._SetColor(r, g, b);
	},

	SetIntensity(this: SDKInstanceClass, intensity: number): void
	{
		this._SetIntensity(intensity);
	},

	SetInnerAngle(this: SDKInstanceClass, angle: number): void
	{
		this._SetInnerAngle(angle);
	},

	SetOuterAngle(this: SDKInstanceClass, angle: number): void
	{
		this._SetOuterAngle(angle);
	},

	SetRange(this: SDKInstanceClass, range: number): void
	{
		this._SetRange(range);
	},

	SetDirection(this: SDKInstanceClass, x: number, y: number, z: number): void
	{
		this._SetDirection(x, y, z);
	}
};

export {}
