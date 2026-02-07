# glTF Static Lighting System - Scripting Developer Guide

This document describes the lighting system used by glTF Static and how to access it via scripting.

## Overview

The lighting system is accessible via:
```javascript
globalThis.GltfBundle.Lighting
```

This provides a complete API for creating, configuring, and managing lights from C3 runtime scripts.

---

## Scripting API Reference

All functions are accessed via `globalThis.GltfBundle.Lighting.*`

### Spotlight Functions

```javascript
const Lighting = globalThis.GltfBundle.Lighting;

// Create a spotlight (returns light ID)
const spotId = Lighting.createSpotLight(
    posX, posY, posZ,           // Position
    dirX, dirY, dirZ,           // Direction (cone axis)
    innerAngleDeg, outerAngleDeg, // Cone angles in degrees
    falloffExponent,            // Edge falloff (default 1.0)
    range                       // Max range (default 0 = infinite)
);

// Configure spotlight
Lighting.setSpotLightEnabled(spotId, true);
Lighting.setSpotLightColor(spotId, 1, 0.8, 0.6);      // RGB 0-1
Lighting.setSpotLightIntensity(spotId, 2.0);
Lighting.setSpotLightPosition(spotId, x, y, z);
Lighting.setSpotLightDirection(spotId, dx, dy, dz);
Lighting.setSpotLightConeAngles(spotId, innerDeg, outerDeg);
Lighting.setSpotLightFalloff(spotId, 1.5);
Lighting.setSpotLightRange(spotId, 500);
Lighting.setSpotLightSpecularEnabled(spotId, true);

// Query spotlight state
Lighting.isSpotLightEnabled(spotId);           // boolean
Lighting.isSpotLightSpecularEnabled(spotId);   // boolean
Lighting.getSpotLight(spotId);                 // SpotLight object or undefined
Lighting.getAllSpotLights();                   // readonly SpotLight[]
Lighting.getSpotLightCount();                  // number
Lighting.hasEnabledSpotLights();               // boolean

// Remove spotlights
Lighting.removeSpotLight(spotId);              // returns boolean
Lighting.removeAllSpotLights();
```

### Directional Light Functions

```javascript
const Lighting = globalThis.GltfBundle.Lighting;

// Create directional light (direction TO the light source)
const lightId = Lighting.createDirectionalLight(dirX, dirY, dirZ);

// Configure directional light
Lighting.setLightEnabled(lightId, true);
Lighting.setLightColor(lightId, 1, 1, 1);       // RGB 0-1
Lighting.setLightIntensity(lightId, 1.5);
Lighting.setLightDirection(lightId, dx, dy, dz);
Lighting.setLightSpecularEnabled(lightId, true);

// Query state
Lighting.isLightEnabled(lightId);              // boolean
Lighting.isLightSpecularEnabled(lightId);      // boolean
Lighting.getLight(lightId);                    // DirectionalLight or undefined
Lighting.getAllLights();                       // readonly DirectionalLight[]
Lighting.getLightCount();                      // number
Lighting.hasEnabledLights();                   // boolean

// Remove lights
Lighting.removeLight(lightId);                 // returns boolean
Lighting.removeAllLights();
```

### Ambient Light Functions

```javascript
const Lighting = globalThis.GltfBundle.Lighting;

// Set ambient light color (RGB 0-1)
Lighting.setAmbientLight(0.2, 0.2, 0.3);

// Get ambient light
Lighting.getAmbientLight();  // Float32Array[3]
```

### Hemisphere Light Functions

```javascript
const Lighting = globalThis.GltfBundle.Lighting;

// Enable/disable
Lighting.setHemisphereLightEnabled(true);
Lighting.isHemisphereLightEnabled();           // boolean

// Configure colors (RGB 0-1)
Lighting.setHemisphereLightSkyColor(0.5, 0.7, 1.0);
Lighting.setHemisphereLightGroundColor(0.2, 0.15, 0.1);
Lighting.setHemisphereLightIntensity(0.8);

// Get hemisphere config
Lighting.getHemisphereLight();  // HemisphereLight object
```

### Specular Configuration

```javascript
const Lighting = globalThis.GltfBundle.Lighting;

// Global specular settings
Lighting.setSpecularShininess(64);     // Higher = tighter highlights
Lighting.setSpecularIntensity(1.0);
Lighting.getSpecularShininess();       // number
Lighting.getSpecularIntensity();       // number

// Debug mode (show specular as blue)
Lighting.setSpecularDebugBlue(true);
Lighting.isSpecularDebugBlue();        // boolean

// Get full config
Lighting.getSpecularConfig();          // SpecularConfig object
```

### Utility Functions

```javascript
const Lighting = globalThis.GltfBundle.Lighting;

// Dirty tracking version (increments on any change)
Lighting.getVersion();                 // number

// Debug: dump all lighting state to console
Lighting.debugLightingState();
```

---

## Complete Examples

### Create and Animate a Spotlight

```javascript
const Lighting = globalThis.GltfBundle.Lighting;

// Create spotlight pointing down
const spotId = Lighting.createSpotLight(
    200, 150, 300,    // Position
    0, 0, -1,         // Direction (pointing down)
    15, 30            // Inner/outer cone angles
);

// Configure it
Lighting.setSpotLightColor(spotId, 1, 0.9, 0.7);  // Warm white
Lighting.setSpotLightIntensity(spotId, 2.0);
Lighting.setSpotLightRange(spotId, 400);

// In tick event - move the spotlight
Lighting.setSpotLightPosition(spotId, newX, newY, newZ);
```

### Set Up Environment Lighting

```javascript
const Lighting = globalThis.GltfBundle.Lighting;

// Ambient base
Lighting.setAmbientLight(0.15, 0.15, 0.2);

// Hemisphere for outdoor feel
Lighting.setHemisphereLightEnabled(true);
Lighting.setHemisphereLightSkyColor(0.4, 0.6, 1.0);    // Blue sky
Lighting.setHemisphereLightGroundColor(0.3, 0.25, 0.2); // Brown ground
Lighting.setHemisphereLightIntensity(0.5);
```

### Day/Night Cycle

```javascript
const Lighting = globalThis.GltfBundle.Lighting;

function setTimeOfDay(hour) {
    // hour: 0-24
    const daylight = Math.sin((hour - 6) / 12 * Math.PI);
    const intensity = Math.max(0, daylight);

    // Ambient gets darker at night
    const ambientLevel = 0.1 + intensity * 0.2;
    Lighting.setAmbientLight(ambientLevel, ambientLevel, ambientLevel * 1.1);

    // Hemisphere intensity follows daylight
    Lighting.setHemisphereLightIntensity(intensity * 0.6);

    // Shift sky color from blue (day) to dark blue (night)
    Lighting.setHemisphereLightSkyColor(
        0.1 + intensity * 0.4,
        0.2 + intensity * 0.5,
        0.4 + intensity * 0.6
    );
}
```

---

## Data Structures

These are the object structures returned by getter functions:

### SpotLight

```javascript
{
    id: number,              // Unique identifier
    enabled: boolean,        // Whether light is active
    color: Float32Array[3],  // RGB (0-1 range)
    intensity: number,       // Multiplier (default 1.0)
    position: Float32Array[3], // World-space [x, y, z]
    direction: Float32Array[3], // Cone axis (normalized)
    innerConeAngle: number,  // Full intensity angle (radians)
    outerConeAngle: number,  // Zero intensity angle (radians)
    falloffExponent: number, // Edge falloff (1.0 = linear)
    range: number,           // Max distance (0 = infinite)
    specularEnabled: boolean // Contributes specular highlights
}
```

### DirectionalLight

```javascript
{
    id: number,              // Unique identifier
    enabled: boolean,        // Whether light is active
    color: Float32Array[3],  // RGB (0-1 range)
    intensity: number,       // Multiplier (default 1.0)
    direction: Float32Array[3], // Direction TO light (normalized)
    specularEnabled: boolean // Contributes specular highlights
}
```

### HemisphereLight

```javascript
{
    enabled: boolean,           // Whether active
    skyColor: Float32Array[3],  // Color for upward normals (0-1)
    groundColor: Float32Array[3], // Color for downward normals (0-1)
    intensity: number           // Multiplier (default 1.0)
}
```

### SpecularConfig

```javascript
{
    shininess: number,  // Power/exponent (default 32.0)
    intensity: number,  // Global multiplier (default 1.0)
    debugBlue: boolean  // Debug mode: show as blue
}
```

---

## Low-Level Access (Advanced)

For addon development or direct manipulation, the lighting state is stored in globalThis variables:

| Variable | Type | Description |
|----------|------|-------------|
| `globalThis.gltfLights` | `DirectionalLight[]` | Directional lights array |
| `globalThis.gltfSpotLights` | `SpotLight[]` | Spotlights array |
| `globalThis.gltfAmbientLight` | `Float32Array[3]` | Ambient RGB (0-1) |
| `globalThis.gltfHemisphereLight` | `HemisphereLight` | Hemisphere config |
| `globalThis.gltfSpecular` | `SpecularConfig` | Specular config |
| `globalThis.gltfLightIdCounter` | `number` | Next light ID |
| `globalThis.gltfLightingVersion` | `number` | Dirty flag |

**Important:** When modifying these directly, always increment `gltfLightingVersion` to trigger recalculation:

```javascript
// Direct modification example
globalThis.gltfAmbientLight[0] = 0.3;
globalThis.gltfAmbientLight[1] = 0.3;
globalThis.gltfAmbientLight[2] = 0.4;
globalThis.gltfLightingVersion++;  // Required!
```

The GltfSpotlight and GltfEnvironment addons use this low-level access to integrate with the lighting system.

---

## Coordinate System

- **Positions**: World-space matching C3 layout (X right, Y down, Z toward viewer)
- **Directional light direction**: Points TO the light source
- **Spotlight direction**: Points in direction light shines (cone axis)
- **Hemisphere**: Uses normal Z component
  - Z = +1 (toward viewer) → sky color
  - Z = -1 (away from viewer) → ground color

---

## Default Values

| Property | Default |
|----------|---------|
| Ambient Light | `[0.2, 0.2, 0.2]` |
| Hemisphere Enabled | `false` |
| Hemisphere Sky Color | `[0.8, 0.9, 1.0]` |
| Hemisphere Ground Color | `[0.2, 0.15, 0.1]` |
| Hemisphere Intensity | `1.0` |
| Specular Shininess | `32.0` |
| Specular Intensity | `1.0` |
| Spotlight Falloff | `1.0` |
| Spotlight Range | `0` (infinite) |

---

## Debugging

```javascript
// Dump complete lighting state to console
globalThis.GltfBundle.Lighting.debugLightingState();

// Enable specular debug mode (shows highlights as blue)
globalThis.GltfBundle.Lighting.setSpecularDebugBlue(true);
```
