"use strict";

const C3 = globalThis.C3;

C3.Plugins.GltfSpotlight.Exps = {
	LightID() {
		return this._LightID();
	},
	Intensity() {
		return this._Intensity();
	},
	InnerAngle() {
		return this._InnerAngle();
	},
	OuterAngle() {
		return this._OuterAngle();
	},
	Range() {
		return this._Range();
	},
	ColorR() {
		return this._ColorR();
	},
	ColorG() {
		return this._ColorG();
	},
	ColorB() {
		return this._ColorB();
	}
};
