import type { SDKInstanceClass } from "./instance.ts";

C3.Plugins.GltfStatic.Cnds =
{
	IsLoaded(this: SDKInstanceClass): boolean
	{
		return this._isModelLoaded();
	},

	OnLoaded(this: SDKInstanceClass): boolean
	{
		return true; // Trigger condition - always returns true when triggered
	},

	OnLoadError(this: SDKInstanceClass): boolean
	{
		return true; // Trigger condition - always returns true when triggered
	},

	IsUsingWorkers(this: SDKInstanceClass): boolean
	{
		return this._isUsingWorkers();
	},

	// Mesh visibility conditions
	IsMeshVisible(this: SDKInstanceClass, name: string): boolean
	{
		return this._isMeshVisible(name);
	},

	IsMeshVisibleByIndex(this: SDKInstanceClass, index: number): boolean
	{
		return this._isMeshVisibleByIndex(index);
	},

	// Animation conditions
	IsAnimationPlaying(this: SDKInstanceClass): boolean
	{
		return this._isAnimationPlaying();
	},

	IsAnimationPaused(this: SDKInstanceClass): boolean
	{
		return this._isAnimationPaused();
	},

	HasAnimation(this: SDKInstanceClass, name: string): boolean
	{
		return this._hasAnimation(name);
	},

	OnAnimationFinished(this: SDKInstanceClass): boolean
	{
		return true; // Trigger condition - always returns true when triggered
	},

	IsBlending(this: SDKInstanceClass): boolean
	{
		return this._isBlending();
	},

	// Bone attachment conditions
	HasBone(this: SDKInstanceClass, name: string): boolean
	{
		return this._hasBone(name);
	},

	// Built-in model conditions
	IsBuiltinEnabled(this: SDKInstanceClass): boolean
	{
		return this._isBuiltinEnabled();
	},

	// Lighting baking conditions
	IsLightingBaked(this: SDKInstanceClass): boolean
	{
		return this._isLightingBaked();
	},

	// Texture animation conditions
	IsTextureAnimPlaying(this: SDKInstanceClass): boolean
	{
		return this._isTextureAnimPlaying();
	},

	OnTextureAnimFinished(this: SDKInstanceClass): boolean
	{
		return true; // Trigger condition
	},

	OnTextureFrameChanged(this: SDKInstanceClass): boolean
	{
		return true; // Trigger condition
	}
};
