# Mesh 3D Plugin Bundle — Reference

Three addons for 3D mesh rendering and lighting in Construct 3.

| Addon | Object name | Purpose |
|-------|-------------|---------|
| gltf-static | **Mesh** | Load, render, and animate 3D models |
| gltf-spotlight | **MeshLight** | Spot and point lights |
| gltf-environment | **MeshSceneLight** | Ambient and hemisphere lighting |

All three addons appear under the **3D** category in the editor.

---

## Mesh

Load and render glTF 3D models (.gltf/.glb). Supports skeletal animation, mesh visibility, texture animation, lighting bake, and built-in primitives (cube, sphere, capsule, cylinder, cone, ramp, plane).

### Properties

| Property | Description |
|----------|-------------|
| Image | Placeholder image for the object in the editor |
| Model File | glTF/GLB model file from the project |
| Model URL (legacy) | Text URL fallback; prefer Model File |
| Rotation X/Y/Z | Initial rotation in degrees |
| Scale | Uniform scale factor applied on load |
| Use Built-in Model | Use a primitive instead of a model file |
| Built-in Model | Cube, Sphere, Capsule, Cylinder, Cone, Ramp, or Plane |

### ACEs

#### glTF

**Conditions**

| Name | Description |
|------|-------------|
| Is loaded | Model has finished loading |
| On loaded | Triggered when model loads successfully |
| On load error | Triggered when model fails to load |
| Is using workers | Worker threads are active for transforms |
| Is mesh visible | Named mesh is visible |
| Is mesh visible by index | Mesh at index is visible |
| Is lighting baked | Static lighting is pre-computed |
| Is built-in enabled | Instance is using a built-in primitive model |

**Actions**

| Name | Parameters | Description |
|------|------------|-------------|
| Load model | URL | Load a glTF model from a URL |
| Set rotation | X, Y, Z (degrees) | Set model rotation |
| Set rotation quaternion | JSON `{"x","y","z","w"}` | Set rotation from quaternion JSON |
| Set rotation quaternion XYZW | X, Y, Z, W | Set rotation from quaternion components |
| Set scale | Scale | Uniform scale (1 = normal) |
| Set scale XYZ | X, Y, Z | Per-axis scale |
| Set worker enabled | Enabled | Toggle worker threads |
| Set mesh visible | Name, Visible | Show/hide mesh by name |
| Set mesh visible by index | Index, Visible | Show/hide mesh by index |
| Show mesh | Name | Show a mesh by name |
| Hide mesh | Name | Hide a mesh by name |
| Show all meshes | | Make all meshes visible |
| Hide all meshes | | Hide all meshes |
| Bake lighting | | Pre-compute lighting into vertex colors |
| Unbake lighting | | Return to dynamic lighting |
| Refresh and bake lighting | | Recalculate and bake from current lights |
| Set built-in enabled | Enabled / Disabled | Toggle built-in model mode; loads selected type when enabled |
| Set built-in model | Cube / Sphere / Capsule / Cylinder / Cone / Ramp / Plane | Select and load a built-in primitive (auto-enables built-in mode) |

**Expressions**

| Name | Description |
|------|-------------|
| `RotationX` | Current X rotation |
| `RotationY` | Current Y rotation |
| `RotationZ` | Current Z rotation |
| `ScaleX` | Current X scale |
| `ScaleY` | Current Y scale |
| `ScaleZ` | Current Z scale |
| `RotationQuaternion` | Quaternion as JSON `{"x","y","z","w"}` |
| `QuatX`, `QuatY`, `QuatZ`, `QuatW` | Individual quaternion components |
| `WorkerEnabled` | 1 if workers enabled |
| `WorkerCount` | Number of active workers |
| `TotalVertices` | Total vertex count |
| `MeshCount` | Number of meshes |
| `MeshNames` | JSON array of mesh names |
| `MeshNameAt(index)` | Mesh name at index |
| `BuiltinModelType` | Current built-in type name (e.g. "cube"), or empty if not using built-in |

#### Animation

**Conditions**

| Name | Description |
|------|-------------|
| Is animation playing | An animation is currently playing |
| Is animation paused | An animation is paused |
| Has animation | Model has an animation with the given name |
| On animation finished | Triggered when a non-looping animation ends |
| Is blending | A crossfade transition is in progress |

**Actions**

| Name | Parameters | Description |
|------|------------|-------------|
| Play animation | Name | Play animation by name |
| Play animation by index | Index | Play animation by index |
| Stop animation | | Stop and keep current pose |
| Pause animation | | Pause playback |
| Resume animation | | Resume from pause |
| Set animation time | Time (seconds) | Jump to a time |
| Set animation speed | Speed | Playback multiplier (1 = normal) |
| Set animation loop | Yes/No | Toggle looping |
| Blend to animation | Name, Duration, Start time | Crossfade to a new animation over duration (seconds) |
| Set animation frame skip | Skip | Frames to skip between updates (0 = every frame) |
| Set frame skip lighting | Enabled | Skip lighting on skipped frames too |
| Set distance LOD enabled | Enabled | Auto frame-skip based on camera distance |
| Set distance LOD thresholds | Full rate radius, Max skip distance, Max skip | Configure distance LOD curve |

**Expressions**

| Name | Description |
|------|-------------|
| `AnimationTime` | Current time in seconds |
| `AnimationDuration` | Duration of current animation |
| `AnimationName` | Name of current animation |
| `AnimationCount` | Number of animations |
| `AnimationNameAt(index)` | Animation name at index |
| `AnimationNames` | JSON array of all animation names |
| `AnimationSpeed` | Current speed multiplier |
| `AnimationProgress` | Progress 0..1 |
| `BlendProgress` | Crossfade progress 0..1 (0 when not blending) |
| `AnimationFrameSkip` | Current frame skip value |
| `FrameSkipLighting` | 1 if lighting skipped on skip frames |
| `DistanceLodEnabled` | 1 if distance LOD active |
| `EffectiveFrameSkip` | Actual skip value (includes distance LOD) |

#### Texture Animation

Animate the model texture using a Sprite's animation frames.

**Conditions**

| Name | Description |
|------|-------------|
| Is texture animation playing | Texture animation is playing |
| On texture animation finished | Non-looping texture animation ended |
| On texture frame changed | Texture advanced to a new frame |

**Actions**

| Name | Parameters | Description |
|------|------------|-------------|
| Set texture source | Sprite | Assign a Sprite as the texture source |
| Play texture animation | From (Beginning / Current frame) | Start playback |
| Stop texture animation | | Stop at current frame |
| Set texture animation | Name, From | Switch to a named animation on the Sprite |
| Set texture animation frame | Frame | Jump to frame index |
| Set texture animation speed | Speed | Speed multiplier |

**Expressions**

| Name | Description |
|------|-------------|
| `TextureAnimFrame` | Current frame index |
| `TextureAnimFrameCount` | Total frames in current animation |
| `TextureAnimSpeed` | Speed multiplier |
| `TextureAnimName` | Current animation name |

#### Bones

Query bone/node positions and rotations from animated models.

**Conditions**

| Name | Description |
|------|-------------|
| Has bone | Bone or node with the given name exists |

**Expressions**

| Name | Description |
|------|-------------|
| `BoneX(name)` | World X position of bone |
| `BoneY(name)` | World Y position |
| `BoneZ(name)` | World Z position |
| `BoneAngle(name)` | 2D angle (Z rotation) in degrees |
| `BoneRotationX(name)` | X rotation in degrees |
| `BoneRotationY(name)` | Y rotation in degrees |
| `BoneRotationZ(name)` | Z rotation in degrees |
| `BoneNames` | JSON array of bone names |
| `BoneCount` | Number of bones |

#### Physics

Bounding box expressions for physics body setup (e.g. Rapier 3D box colliders).

**Expressions**

| Name | Description |
|------|-------------|
| `BBoxWidth` | World-space width (X) |
| `BBoxHeight` | World-space height (Y) |
| `BBoxDepth` | World-space depth (Z) |
| `BBoxHalfWidth` | Half width (for box shapes) |
| `BBoxHalfHeight` | Half height |
| `BBoxHalfDepth` | Half depth |
| `BBoxScale` | Bounding box scale factor |

### Script Interface

Access via `runtime.objects.Mesh.getFirstInstance()` or iterate instances. All script methods use underscore-prefix naming.

#### Transform

| Method | Description |
|--------|-------------|
| `_setRotation(x: number, y: number, z: number): void` | Set rotation in degrees |
| `_getRotationX(): number` | X rotation |
| `_getRotationY(): number` | Y rotation |
| `_getRotationZ(): number` | Z rotation |
| `_setRotationQuaternion(x: number, y: number, z: number, w: number): void` | Set rotation as quaternion |
| `_setRotationQuaternionJson(json: string): void` | Set from JSON `{"x","y","z","w"}` |
| `_getRotationQuaternion(): [number, number, number, number]` | Get quaternion array |
| `_getRotationQuaternionJson(): string` | Get quaternion as JSON |
| `_getQuatX(): number` | Quaternion X component |
| `_getQuatY(): number` | Quaternion Y component |
| `_getQuatZ(): number` | Quaternion Z component |
| `_getQuatW(): number` | Quaternion W component |
| `_setScale(scale: number): void` | Uniform scale |
| `_setScaleXYZ(x: number, y: number, z: number): void` | Per-axis scale |
| `_getScaleX(): number` | Current X scale |
| `_getScaleY(): number` | Current Y scale |
| `_getScaleZ(): number` | Current Z scale |
| `quaternion: { x: number; y: number; z: number; w: number }` | Get/set quaternion as object (property) |

#### Model

| Method | Description |
|--------|-------------|
| `_loadModel(url: string): Promise<void>` | Load model (async) |
| `_isModelLoaded(): boolean` | Loading state |
| `loaded: boolean` | Read-only loaded state (property) |
| `_getTotalVertices(): number` | Vertex count |
| `_getMeshCount(): number` | Mesh count |
| `_getMeshNames(): string` | JSON array of names |
| `_getMeshNameAt(index: number): string` | Name at index |

#### Built-in Model

| Method | Description |
|--------|-------------|
| `_isBuiltinEnabled(): boolean` | Whether built-in mode is active |
| `_setBuiltinEnabled(enabled: boolean): void` | Toggle built-in mode; loads selected type when enabled |
| `_setBuiltinModel(typeIndex: number): void` | Select and load a built-in primitive (0=cube, 1=sphere, 2=capsule, 3=cylinder, 4=cone, 5=ramp, 6=plane) |
| `_getBuiltinModelType(): string` | Current type name, or empty if not using built-in |

#### Mesh Visibility

| Method | Description |
|--------|-------------|
| `_setMeshVisible(name: string, visible: boolean): void` | By name |
| `_isMeshVisible(name: string): boolean` | By name |
| `_setMeshVisibleByIndex(index: number, visible: boolean): void` | By index |
| `_isMeshVisibleByIndex(index: number): boolean` | By index |
| `_showAllMeshes(): void` | Show all |
| `_hideAllMeshes(): void` | Hide all |

#### Animation

| Method | Description |
|--------|-------------|
| `_playAnimation(name: string): void` | Play by name |
| `_playAnimationByIndex(index: number): void` | Play by index |
| `_stopAnimation(): void` | Stop, keep pose |
| `_pauseAnimation(): void` | Pause |
| `_resumeAnimation(): void` | Resume |
| `_setAnimationTime(time: number): void` | Jump to time (seconds) |
| `_setAnimationSpeed(speed: number): void` | Speed multiplier |
| `_setAnimationLoop(loop: boolean): void` | Toggle loop |
| `_isAnimationPlaying(): boolean` | Playing state |
| `_isAnimationPaused(): boolean` | Paused state |
| `_getAnimationTime(): number` | Current time |
| `_getAnimationDuration(): number` | Duration |
| `_getAnimationName(): string` | Current name |
| `_getAnimationCount(): number` | Count |
| `_getAnimationNameAt(index: number): string` | Name at index |
| `_getAnimationNamesJson(): string` | JSON array |
| `_getAnimationSpeed(): number` | Speed |
| `_getAnimationProgress(): number` | 0..1 progress |
| `_hasAnimation(name: string): boolean` | Check by name |
| `_blendToAnimation(name: string, duration: number, startTime: number): void` | Crossfade |
| `_isBlending(): boolean` | Blend active |
| `_getBlendProgress(): number` | 0..1 blend progress |

#### Animation Performance

| Method | Description |
|--------|-------------|
| `_setAnimationFrameSkip(skip: number): void` | Frames to skip |
| `_getAnimationFrameSkip(): number` | Current skip |
| `_setFrameSkipLighting(enabled: boolean): void` | Skip lighting too |
| `_getFrameSkipLighting(): boolean` | Lighting skip state |
| `_setDistanceLodEnabled(enabled: boolean): void` | Distance-based LOD |
| `_getDistanceLodEnabled(): boolean` | LOD state |
| `_setDistanceLodThresholds(fullRateRadius: number, maxSkipDistance: number, maxSkip: number): void` | Configure LOD |
| `_getEffectiveFrameSkip(): number` | Actual skip |

#### Workers

| Method | Description |
|--------|-------------|
| `_setWorkerEnabled(enabled: boolean): void` | Toggle workers |
| `_isUsingWorkers(): boolean` | Workers active |
| `_getWorkerEnabled(): number` | 1 if enabled, 0 otherwise |
| `_getWorkerCount(): number` | Worker count |

#### Lighting Bake

| Method | Description |
|--------|-------------|
| `_bakeLighting(): void` | Bake current lighting |
| `_unbakeLighting(): void` | Return to dynamic |
| `_refreshAndBakeLighting(): void` | Recalculate and bake |
| `_isLightingBaked(): boolean` | Baked state |

#### Lighting (Directional)

| Method | Description |
|--------|-------------|
| `_createDirectionalLight(dirX: number, dirY: number, dirZ: number): number` | Create, returns ID |
| `_setLightEnabled(id: number, enabled: boolean): void` | Toggle |
| `_isLightEnabled(id: number): boolean` | Enabled state |
| `_setLightColor(id: number, r: number, g: number, b: number): void` | Color |
| `_setLightIntensity(id: number, intensity: number): void` | Brightness |
| `_setLightDirection(id: number, x: number, y: number, z: number): void` | Direction |
| `_removeLight(id: number): boolean` | Remove by ID |
| `_removeAllLights(): void` | Remove all |
| `_getLightCount(): number` | Count |
| `_hasEnabledLights(): boolean` | Any enabled |

#### Lighting (Spot / Point)

| Method | Description |
|--------|-------------|
| `_createSpotLight(posX: number, posY: number, posZ: number, dirX: number, dirY: number, dirZ: number, innerAngle: number, outerAngle: number): number` | Create spotlight, returns ID |
| `_setSpotLightPosition(id: number, x: number, y: number, z: number): void` | Move light |
| `_setSpotLightDirection(id: number, x: number, y: number, z: number): void` | Aim light |
| `_setSpotLightConeAngles(id: number, innerAngle: number, outerAngle: number): void` | Cone angles |
| `_setSpotLightFalloff(id: number, exponent: number): void` | Falloff curve |
| `_setSpotLightRange(id: number, range: number): void` | Max distance |
| `_setSpotLightEnabled(id: number, enabled: boolean): void` | Toggle |
| `_setSpotLightColor(id: number, r: number, g: number, b: number): void` | Color |
| `_setSpotLightIntensity(id: number, intensity: number): void` | Brightness |
| `_removeSpotLight(id: number): boolean` | Remove by ID |
| `_removeAllSpotLights(): void` | Remove all |
| `_getSpotLightCount(): number` | Count |
| `_hasEnabledSpotLights(): boolean` | Any enabled |

#### Lighting (Ambient / Hemisphere)

| Method | Description |
|--------|-------------|
| `_setAmbientLight(r: number, g: number, b: number): void` | Ambient color |
| `_setHemisphereLightEnabled(enabled: boolean): void` | Toggle hemisphere |
| `_isHemisphereLightEnabled(): boolean` | Hemisphere state |
| `_setHemisphereLightSkyColor(r: number, g: number, b: number): void` | Sky color |
| `_setHemisphereLightGroundColor(r: number, g: number, b: number): void` | Ground color |
| `_setHemisphereLightIntensity(intensity: number): void` | Brightness |
| `_getHemisphereLightIntensity(): number` | Current intensity |
| `_getHemisphereLightSkyColor(): [number, number, number]` | Sky RGB |
| `_getHemisphereLightGroundColor(): [number, number, number]` | Ground RGB |

#### Bones

| Method | Description |
|--------|-------------|
| `_getBonePosition(name: string): [number, number, number] \| null` | World position |
| `_getBoneRotation(name: string): [number, number, number] \| null` | Rotation in degrees |
| `_getBoneAngle(name: string): number` | 2D angle (Z rotation) |
| `_getBoneNames(): string` | JSON array |
| `_getBoneCount(): number` | Count |
| `_hasBone(name: string): boolean` | Check exists |

#### Bounding Box

| Method | Description |
|--------|-------------|
| `_getBoundingBox(): { min: [number, number, number]; max: [number, number, number] } \| null` | Min/max corners |
| `_getBoundingBoxSize(): [number, number, number] \| null` | Model-space size |
| `_getWorldBoundingBoxSize(): [number, number, number] \| null` | With scale applied |
| `_getHalfExtents(): [number, number, number] \| null` | Half-sizes for physics |
| `_setBBoxScale(scale: number): void` | Scale factor |
| `_getBBoxScale(): number` | Current scale |
| `xMinBB: [number, number, number]` | Bounding box min (property) |
| `xMaxBB: [number, number, number]` | Bounding box max (property) |

#### Texture Animation

| Method | Description |
|--------|-------------|
| `_setTextureSource(objectClass: any): void` | Assign Sprite object class |
| `_playTextureAnimation(fromBeginning: boolean): void` | Start playback |
| `_stopTextureAnimation(): void` | Stop |
| `_setTextureAnimation(name: string, fromBeginning: boolean): void` | Switch animation |
| `_setTextureAnimFrame(frame: number): void` | Jump to frame |
| `_setTextureAnimSpeed(speed: number): void` | Speed multiplier |
| `_isTextureAnimPlaying(): boolean` | Playing state |
| `_getTextureAnimFrame(): number` | Current frame |
| `_getTextureAnimSpeed(): number` | Speed |
| `_getTextureAnimName(): string` | Current name |
| `_getTextureAnimFrameCount(): number` | Frame count |

#### Debug

| Method | Description |
|--------|-------------|
| `_setDebug(enabled: boolean): void` | Toggle debug logging |
| `_getDebug(): boolean` | Debug state |

---

## MeshLight

Spot or point light for 3D mesh models. Position is set by the object's X/Y/Z in the layout. Direction and cone angles apply to spotlights only.

### Properties

| Property | Description |
|----------|-------------|
| Light type | Spot (cone) or Point (omnidirectional) |
| Enabled | Whether the light is active |
| Color | RGB color |
| Intensity | Brightness multiplier |
| Inner angle | Full intensity cone angle in degrees (spot only) |
| Outer angle | Falloff cone angle in degrees (spot only) |
| Range | Maximum distance the light reaches |
| Direction X/Y/Z | Direction vector components (spot only) |
| Shadow | Physics-based occlusion via raycasts |

### ACEs

#### Spotlight

**Conditions**

| Name | Description |
|------|-------------|
| Is enabled | Light is active |

**Actions**

| Name | Parameters | Description |
|------|------------|-------------|
| Set light type | Spot / Point | Switch light type |
| Set enabled | Enabled / Disabled | Toggle light |
| Set color | R, G, B (0-255) | Set light color |
| Set intensity | Intensity | Brightness multiplier |
| Set inner angle | Angle (degrees) | Full intensity cone (spot only) |
| Set outer angle | Angle (degrees) | Falloff cone (spot only) |
| Set range | Range | Maximum light distance |
| Set direction | X, Y, Z | Direction vector (spot only) |

**Expressions**

| Name | Description |
|------|-------------|
| `LightID` | Internal light ID for scripting |
| `Intensity` | Light intensity |
| `InnerAngle` | Inner cone angle |
| `OuterAngle` | Outer cone angle |
| `Range` | Distance range |
| `ColorR`, `ColorG`, `ColorB` | Color components (0-255) |
| `DirectionX`, `DirectionY`, `DirectionZ` | Direction vector |

### Script Interface

MeshLight does not expose a custom script interface class. Use ACE expressions or the global Lighting API via `globalThis.GltfBundle.Lighting` with the `LightID` expression to control lights from script.

---

## MeshSceneLight

Ambient and hemisphere lighting for the scene. Place one in the layout to set global lighting. Hemisphere lighting blends a sky color (from above) with a ground color (from below) based on surface normals.

### Properties

| Property | Description |
|----------|-------------|
| Ambient color | RGB color for ambient light |
| Ambient intensity | Ambient brightness multiplier |
| Hemisphere enabled | Toggle hemisphere lighting |
| Sky color | Color from above |
| Ground color | Color from below |
| Hemisphere intensity | Hemisphere brightness multiplier |

### ACEs

#### Environment

**Conditions**

| Name | Description |
|------|-------------|
| Is hemisphere enabled | Hemisphere lighting is active |

**Actions**

| Name | Parameters | Description |
|------|------------|-------------|
| Set ambient color | R, G, B (0-255) | Ambient light color |
| Set ambient intensity | Intensity | Ambient brightness |
| Set hemisphere enabled | Enabled / Disabled | Toggle hemisphere |
| Set sky color | R, G, B (0-255) | Sky direction color |
| Set ground color | R, G, B (0-255) | Ground direction color |
| Set hemisphere intensity | Intensity | Hemisphere brightness |
| Set color blend mode | None / Multiply / Screen / Overlay / Add | How vertex colors blend with lighting |

**Expressions**

| Name | Description |
|------|-------------|
| `AmbientIntensity` | Ambient brightness |
| `AmbientColorR`, `AmbientColorG`, `AmbientColorB` | Ambient color (0-255) |
| `HemisphereIntensity` | Hemisphere brightness |
| `SkyColorR`, `SkyColorG`, `SkyColorB` | Sky color (0-255) |
| `GroundColorR`, `GroundColorG`, `GroundColorB` | Ground color (0-255) |
| `ColorBlendMode` | Current blend mode name |

### Script Interface

MeshSceneLight does not expose a custom script interface class. Use ACE expressions or the global Lighting API via `globalThis.GltfBundle.Lighting` to control environment lighting from script.

---

## Global Lighting API

All lighting state is managed through `globalThis.GltfBundle.Lighting`. This API is shared across all three addons and can be called directly from script.

### Spot / Point Lights

| Method | Description |
|--------|-------------|
| `createSpotLight(posX: number, posY: number, posZ: number, dirX: number, dirY: number, dirZ: number, innerAngleDeg: number, outerAngleDeg: number, falloffExponent?: number, range?: number): number` | Create spotlight (falloff default 1.0, range default 0 = infinite), returns ID |
| `createPointLight(posX: number, posY: number, posZ: number, range?: number): number` | Create point light (omnidirectional), returns ID |
| `setSpotLightPosition(id: number, x: number, y: number, z: number): void` | Move light |
| `setSpotLightDirection(id: number, x: number, y: number, z: number): void` | Aim light (spot only) |
| `setSpotLightConeAngles(id: number, innerDeg: number, outerDeg: number): void` | Cone angles in degrees (spot only) |
| `setSpotLightColor(id: number, r: number, g: number, b: number): void` | Color (0..1 float) |
| `setSpotLightIntensity(id: number, intensity: number): void` | Brightness |
| `setSpotLightRange(id: number, range: number): void` | Max distance (0 = infinite) |
| `setSpotLightFalloff(id: number, exponent: number): void` | Falloff curve |
| `setSpotLightEnabled(id: number, enabled: boolean): void` | Toggle |
| `setSpotLightType(id: number, type: "spot" \| "point"): void` | Switch light type |
| `setSpotLightSpecularEnabled(id: number, enabled: boolean): void` | Toggle specular contribution |
| `setSpotLightShadow(id: number, enabled: boolean): void` | Toggle physics-based shadow |
| `getSpotLight(id: number): SpotLight \| undefined` | Get light object by ID |
| `getAllSpotLights(): readonly SpotLight[]` | All spot/point lights |
| `isSpotLightEnabled(id: number): boolean` | Enabled state |
| `isSpotLightSpecularEnabled(id: number): boolean` | Specular state |
| `getSpotLightCount(): number` | Count |
| `hasEnabledSpotLights(): boolean` | Any enabled |
| `removeSpotLight(id: number): boolean` | Remove by ID |
| `removeAllSpotLights(): void` | Remove all |

### Directional Lights

| Method | Description |
|--------|-------------|
| `createDirectionalLight(dirX: number, dirY: number, dirZ: number): number` | Create, returns ID. Direction points TO light source |
| `setLightDirection(id: number, x: number, y: number, z: number): void` | Direction |
| `setLightColor(id: number, r: number, g: number, b: number): void` | Color (0..1 float) |
| `setLightIntensity(id: number, intensity: number): void` | Brightness |
| `setLightEnabled(id: number, enabled: boolean): void` | Toggle |
| `setLightSpecularEnabled(id: number, enabled: boolean): void` | Toggle specular contribution |
| `getLight(id: number): DirectionalLight \| undefined` | Get light object by ID |
| `getAllLights(): readonly DirectionalLight[]` | All directional lights |
| `isLightEnabled(id: number): boolean` | Enabled state |
| `isLightSpecularEnabled(id: number): boolean` | Specular state |
| `getLightCount(): number` | Count |
| `hasEnabledLights(): boolean` | Any enabled |
| `removeLight(id: number): boolean` | Remove by ID |
| `removeAllLights(): void` | Remove all |

### Ambient

| Method | Description |
|--------|-------------|
| `setAmbientLight(r: number, g: number, b: number): void` | Set ambient color (0..1 float) |
| `getAmbientLight(): Float32Array` | Current RGB as Float32Array[3] |

### Hemisphere

| Method | Description |
|--------|-------------|
| `setHemisphereLightEnabled(enabled: boolean): void` | Toggle |
| `isHemisphereLightEnabled(): boolean` | State |
| `setHemisphereLightSkyColor(r: number, g: number, b: number): void` | Sky color (0..1 float) |
| `setHemisphereLightGroundColor(r: number, g: number, b: number): void` | Ground color (0..1 float) |
| `setHemisphereLightIntensity(intensity: number): void` | Brightness |
| `getHemisphereLight(): HemisphereLight` | Full hemisphere config object |

### Color Blend Mode

| Method | Description |
|--------|-------------|
| `setColorBlendMode(mode: "none" \| "multiply" \| "screen" \| "overlay" \| "add"): void` | Vertex color blend mode |
| `getColorBlendMode(): string` | Current blend mode |

### Specular

| Method | Description |
|--------|-------------|
| `setSpecularShininess(value: number): void` | Specular exponent (default 32) |
| `setSpecularIntensity(value: number): void` | Specular strength (default 1.0) |
| `getSpecularShininess(): number` | Current exponent |
| `getSpecularIntensity(): number` | Current strength |
| `setSpecularDebugBlue(enabled: boolean): void` | Show specular as blue for debugging |
| `isSpecularDebugBlue(): boolean` | Debug mode state |
| `getSpecularConfig(): SpecularConfig` | Full config object |

### Utility

| Method | Description |
|--------|-------------|
| `getVersion(): number` | Lighting dirty flag (increments on any change) |
| `debugLightingState(): void` | Log all lighting state to console |

### Data Structures

```typescript
interface SpotLight {
    id: number;
    type?: "spot" | "point";
    enabled: boolean;
    color: Float32Array;         // RGB [3], range 0..1
    intensity: number;
    position: Float32Array;      // [x, y, z]
    direction: Float32Array;     // [x, y, z] normalized
    innerConeAngle: number;      // radians
    outerConeAngle: number;      // radians
    falloffExponent: number;
    range: number;               // 0 = infinite
    specularEnabled: boolean;
}

interface DirectionalLight {
    id: number;
    enabled: boolean;
    color: Float32Array;         // RGB [3], range 0..1
    intensity: number;
    direction: Float32Array;     // [x, y, z] points TO light source
    specularEnabled: boolean;
}

interface HemisphereLight {
    enabled: boolean;
    skyColor: Float32Array;      // RGB [3], range 0..1
    groundColor: Float32Array;   // RGB [3], range 0..1
    intensity: number;
}

interface SpecularConfig {
    shininess: number;           // default 32
    intensity: number;           // default 1.0
    debugBlue: boolean;
}
```
