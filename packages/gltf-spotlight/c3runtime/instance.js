// Property indices matching plugin.ts order
const PROP_ENABLED = 0;
const PROP_COLOR = 1;
const PROP_INTENSITY = 2;
const PROP_INNER_ANGLE = 3;
const PROP_OUTER_ANGLE = 4;
const PROP_RANGE = 5;
const PROP_DIR_X = 6;
const PROP_DIR_Y = 7;
const PROP_DIR_Z = 8;
/**
 * Get the Lighting API if available (glTF Static loaded)
 */
function getLightingAPI() {
    return globalThis.GltfBundle?.Lighting;
}
C3.Plugins.GltfSpotlight.Instance = class GltfSpotlightInstance extends ISDKWorldInstanceBase {
    constructor() {
        super();
        this._lightId = -1;
        this._enabled = true;
        this._color = [1, 1, 1];
        this._intensity = 1;
        this._innerAngle = 15;
        this._outerAngle = 30;
        this._range = 0;
        this._dirX = 1;
        this._dirY = 0;
        this._dirZ = 0;
        const properties = this._getInitProperties();
        if (properties) {
            this._enabled = properties[PROP_ENABLED];
            // Color comes as [r, g, b] array already in 0-1 range (SDK v2)
            this._color = properties[PROP_COLOR];
            this._intensity = properties[PROP_INTENSITY];
            this._innerAngle = properties[PROP_INNER_ANGLE];
            this._outerAngle = properties[PROP_OUTER_ANGLE];
            this._range = properties[PROP_RANGE];
            this._dirX = properties[PROP_DIR_X];
            this._dirY = properties[PROP_DIR_Y];
            this._dirZ = properties[PROP_DIR_Z];
        }
        this._createSpotLight();
        // Enable ticking so _tick() is called each frame
        this._setTicking(true);
    }
    _release() {
        // Stop ticking
        this._setTicking(false);
        const Lighting = getLightingAPI();
        if (Lighting && this._lightId >= 0) {
            Lighting.removeSpotLight(this._lightId);
        }
        super._release();
    }
    _createSpotLight() {
        const Lighting = getLightingAPI();
        if (!Lighting)
            return; // glTF Static not loaded yet
        // Create spotlight using Lighting API with direction from properties
        // Use totalZElevation to account for parent hierarchy
        this._lightId = Lighting.createSpotLight(this.x, this.y, this.totalZElevation, this._dirX, this._dirY, this._dirZ, this._innerAngle, this._outerAngle, 1.0, // falloffExponent
        this._range);
        // Set additional properties
        Lighting.setSpotLightEnabled(this._lightId, this._enabled);
        Lighting.setSpotLightColor(this._lightId, this._color[0], this._color[1], this._color[2]);
        Lighting.setSpotLightIntensity(this._lightId, this._intensity);
    }
    _updateSpotLight() {
        const Lighting = getLightingAPI();
        // If API not available yet, try to create the light
        if (!Lighting) {
            return;
        }
        // If light not created yet (API became available), create it now
        if (this._lightId < 0) {
            this._createSpotLight();
            return;
        }
        // Update via Lighting API
        // Use totalZElevation to account for parent hierarchy
        Lighting.setSpotLightEnabled(this._lightId, this._enabled);
        Lighting.setSpotLightColor(this._lightId, this._color[0], this._color[1], this._color[2]);
        Lighting.setSpotLightIntensity(this._lightId, this._intensity);
        Lighting.setSpotLightPosition(this._lightId, this.x, this.y, this.totalZElevation);
        Lighting.setSpotLightDirection(this._lightId, this._dirX, this._dirY, this._dirZ);
        Lighting.setSpotLightConeAngles(this._lightId, this._innerAngle, this._outerAngle);
        Lighting.setSpotLightRange(this._lightId, this._range);
    }
    _tick() {
        // Update position each tick in case instance moved
        this._updateSpotLight();
    }
    // === Actions ===
    _SetEnabled(enabled) {
        this._enabled = (enabled === 1);
        const Lighting = getLightingAPI();
        if (Lighting && this._lightId >= 0) {
            Lighting.setSpotLightEnabled(this._lightId, this._enabled);
        }
    }
    _SetColor(r, g, b) {
        this._color = [r / 255, g / 255, b / 255];
        const Lighting = getLightingAPI();
        if (Lighting && this._lightId >= 0) {
            Lighting.setSpotLightColor(this._lightId, this._color[0], this._color[1], this._color[2]);
        }
    }
    _SetIntensity(intensity) {
        this._intensity = intensity;
        const Lighting = getLightingAPI();
        if (Lighting && this._lightId >= 0) {
            Lighting.setSpotLightIntensity(this._lightId, intensity);
        }
    }
    _SetInnerAngle(angle) {
        this._innerAngle = angle;
        const Lighting = getLightingAPI();
        if (Lighting && this._lightId >= 0) {
            Lighting.setSpotLightConeAngles(this._lightId, this._innerAngle, this._outerAngle);
        }
    }
    _SetOuterAngle(angle) {
        this._outerAngle = angle;
        const Lighting = getLightingAPI();
        if (Lighting && this._lightId >= 0) {
            Lighting.setSpotLightConeAngles(this._lightId, this._innerAngle, this._outerAngle);
        }
    }
    _SetRange(range) {
        this._range = range;
        const Lighting = getLightingAPI();
        if (Lighting && this._lightId >= 0) {
            Lighting.setSpotLightRange(this._lightId, range);
        }
    }
    _SetDirection(x, y, z) {
        this._dirX = x;
        this._dirY = y;
        this._dirZ = z;
        const Lighting = getLightingAPI();
        if (Lighting && this._lightId >= 0) {
            Lighting.setSpotLightDirection(this._lightId, x, y, z);
        }
    }
    // === Conditions ===
    _IsEnabled() {
        return this._enabled;
    }
    // === Expressions ===
    _LightID() {
        return this._lightId;
    }
    _Intensity() {
        return this._intensity;
    }
    _InnerAngle() {
        return this._innerAngle;
    }
    _OuterAngle() {
        return this._outerAngle;
    }
    _Range() {
        return this._range;
    }
    _ColorR() {
        return Math.round(this._color[0] * 255);
    }
    _ColorG() {
        return Math.round(this._color[1] * 255);
    }
    _ColorB() {
        return Math.round(this._color[2] * 255);
    }
    _DirectionX() {
        return this._dirX;
    }
    _DirectionY() {
        return this._dirY;
    }
    _DirectionZ() {
        return this._dirZ;
    }
    // === Save/Load ===
    _saveToJson() {
        return {
            "enabled": this._enabled,
            "color": this._color,
            "intensity": this._intensity,
            "innerAngle": this._innerAngle,
            "outerAngle": this._outerAngle,
            "range": this._range,
            "dirX": this._dirX,
            "dirY": this._dirY,
            "dirZ": this._dirZ
        };
    }
    _loadFromJson(o) {
        const data = o;
        this._enabled = data["enabled"];
        this._color = data["color"];
        this._intensity = data["intensity"];
        this._innerAngle = data["innerAngle"];
        this._outerAngle = data["outerAngle"];
        this._range = data["range"];
        this._dirX = data["dirX"] ?? 1;
        this._dirY = data["dirY"] ?? 0;
        this._dirZ = data["dirZ"] ?? 0;
        this._updateSpotLight();
    }
};
export {};
