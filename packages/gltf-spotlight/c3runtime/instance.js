// Light type constants
const LIGHT_TYPE_SPOT = "spot";
const LIGHT_TYPE_POINT = "point";
// Combo index for the LightType property (must match plugin.ts items order: ["spot", "point"])
const COMBO_LIGHT_TYPE_SPOT = 0;
const COMBO_LIGHT_TYPE_POINT = 1;
// Property indices matching plugin.ts order
const PROP_LIGHT_TYPE = 0;
const PROP_ENABLED = 1;
const PROP_COLOR = 2;
const PROP_INTENSITY = 3;
const PROP_INNER_ANGLE = 4;
const PROP_OUTER_ANGLE = 5;
const PROP_RANGE = 6;
const PROP_DIR_X = 7;
const PROP_DIR_Y = 8;
const PROP_DIR_Z = 9;
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
        this._lightType = LIGHT_TYPE_SPOT;
        this._enabled = true;
        this._color = [1, 1, 1];
        this._intensity = 1;
        this._innerAngle = 15;
        this._outerAngle = 30;
        this._range = 10000;
        this._dirX = 1;
        this._dirY = 0;
        this._dirZ = 0;
        // Dirty tracking for position updates
        this._lastX = NaN;
        this._lastY = NaN;
        this._lastZ = NaN;
        this._needsUpdate = true;
        const properties = this._getInitProperties();
        if (properties) {
            // PROP_LIGHT_TYPE is combo: COMBO_LIGHT_TYPE_SPOT=0, COMBO_LIGHT_TYPE_POINT=1
            this._lightType = properties[PROP_LIGHT_TYPE] === COMBO_LIGHT_TYPE_POINT ? LIGHT_TYPE_POINT : LIGHT_TYPE_SPOT;
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
        this._createLight();
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
    _createLight() {
        const Lighting = getLightingAPI();
        if (!Lighting)
            return; // glTF Static not loaded yet
        if (this._lightType === LIGHT_TYPE_POINT) {
            this._lightId = Lighting.createPointLight(this.x, this.y, this.totalZ, this._range);
        }
        else {
            this._lightId = Lighting.createSpotLight(this.x, this.y, this.totalZ, this._dirX, this._dirY, this._dirZ, this._innerAngle, this._outerAngle, 1.0, // falloffExponent
            this._range);
        }
        // Set common properties
        Lighting.setSpotLightEnabled(this._lightId, this._enabled);
        Lighting.setSpotLightColor(this._lightId, this._color[0], this._color[1], this._color[2]);
        Lighting.setSpotLightIntensity(this._lightId, this._intensity);
    }
    _updateLight() {
        const Lighting = getLightingAPI();
        // If API not available yet, try to create the light
        if (!Lighting) {
            return;
        }
        // If light not created yet (API became available), create it now
        if (this._lightId < 0) {
            this._createLight();
            return;
        }
        // Update common properties via Lighting API
        Lighting.setSpotLightType(this._lightId, this._lightType);
        Lighting.setSpotLightEnabled(this._lightId, this._enabled);
        Lighting.setSpotLightColor(this._lightId, this._color[0], this._color[1], this._color[2]);
        Lighting.setSpotLightIntensity(this._lightId, this._intensity);
        Lighting.setSpotLightPosition(this._lightId, this.x, this.y, this.totalZ);
        Lighting.setSpotLightRange(this._lightId, this._range);
        // Spotlight-specific updates (skipped for point lights)
        if (this._lightType !== LIGHT_TYPE_POINT) {
            Lighting.setSpotLightDirection(this._lightId, this._dirX, this._dirY, this._dirZ);
            Lighting.setSpotLightConeAngles(this._lightId, this._innerAngle, this._outerAngle);
        }
    }
    _tick() {
        // Check if position changed or update is needed
        const currentX = this.x;
        const currentY = this.y;
        const currentZ = this.totalZ;
        const positionChanged = currentX !== this._lastX ||
            currentY !== this._lastY ||
            currentZ !== this._lastZ;
        if (positionChanged || this._needsUpdate) {
            this._lastX = currentX;
            this._lastY = currentY;
            this._lastZ = currentZ;
            this._needsUpdate = false;
            this._updateLight();
        }
    }
    // === Actions ===
    _SetLightType(typeIdx) {
        this._lightType = typeIdx === COMBO_LIGHT_TYPE_POINT ? LIGHT_TYPE_POINT : LIGHT_TYPE_SPOT;
        const Lighting = getLightingAPI();
        if (Lighting && this._lightId >= 0) {
            Lighting.setSpotLightType(this._lightId, this._lightType);
        }
    }
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
        if (Lighting && this._lightId >= 0 && this._lightType !== LIGHT_TYPE_POINT) {
            Lighting.setSpotLightConeAngles(this._lightId, this._innerAngle, this._outerAngle);
        }
    }
    _SetOuterAngle(angle) {
        this._outerAngle = angle;
        const Lighting = getLightingAPI();
        if (Lighting && this._lightId >= 0 && this._lightType !== LIGHT_TYPE_POINT) {
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
        if (Lighting && this._lightId >= 0 && this._lightType !== LIGHT_TYPE_POINT) {
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
            "lightType": this._lightType,
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
        this._lightType = data["lightType"] ?? LIGHT_TYPE_SPOT;
        this._enabled = data["enabled"];
        this._color = data["color"];
        this._intensity = data["intensity"];
        this._innerAngle = data["innerAngle"];
        this._outerAngle = data["outerAngle"];
        this._range = data["range"];
        this._dirX = data["dirX"] ?? 1;
        this._dirY = data["dirY"] ?? 0;
        this._dirZ = data["dirZ"] ?? 0;
        // Force full update on next tick
        this._needsUpdate = true;
    }
};
export {};
