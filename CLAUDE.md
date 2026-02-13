# Claude Code Guidelines for glTF Plugins Monorepo

## Project Overview

This is a monorepo containing Construct 3 plugins for glTF 3D model rendering and lighting:

- **gltf-static** - Main plugin for loading and rendering glTF 3D models
- **gltf-spotlight** - Spotlight lighting addon (editor + runtime)
- **gltf-environment** - Ambient/hemisphere lighting addon (editor + runtime)
- **shared-types** - Shared TypeScript interfaces for editor lighting

## Architecture

### Lighting API

The lighting system is exposed via `globalThis.GltfBundle.Lighting` with a complete scripting API.

See [packages/gltf-static/LIGHTING.md](packages/gltf-static/LIGHTING.md) for full documentation.

### Runtime Integration

The lighting addons integrate with glTF Static via the Lighting API:

1. **Editor**: Addons write to `globalThis.gltfEditorSpotlights` and `globalThis.gltfEditorEnvironment`
   - glTF Static editor reads these during `Draw()` for preview lighting

2. **Runtime**: Addons use `globalThis.GltfBundle.Lighting.*` functions:
   - GltfSpotlight creates/updates spotlights via `createSpotLight()`, `setSpotLightPosition()`, etc.
   - GltfEnvironment updates ambient/hemisphere via `setAmbientLight()`, `setHemisphereLightEnabled()`, etc.

### Communication Flow (Runtime)
```
GltfSpotlight addon
    → globalThis.GltfBundle.Lighting.createSpotLight()
    → globalThis.GltfBundle.Lighting.setSpotLight*()
                              ↓
GltfEnvironment addon
    → globalThis.GltfBundle.Lighting.setAmbientLight()
    → globalThis.GltfBundle.Lighting.setHemisphereLight*()
                              ↓
GltfStatic runtime automatically uses this lighting data
```

### Key Scripting Examples

```javascript
const Lighting = globalThis.GltfBundle.Lighting;

// Create spotlight
const id = Lighting.createSpotLight(x, y, z, dirX, dirY, dirZ, innerAngle, outerAngle);
Lighting.setSpotLightColor(id, 1, 0.8, 0.6);
Lighting.setSpotLightIntensity(id, 2.0);

// Environment lighting
Lighting.setAmbientLight(0.2, 0.2, 0.3);
Lighting.setHemisphereLightEnabled(true);
Lighting.setHemisphereLightSkyColor(0.5, 0.7, 1.0);
```

## C3 3D Bounding Box Support (r472+)

C3 now tracks 3D bounding boxes natively. Key APIs:

- `IWorldInstance.getBoundingBox3d()` - returns `IAABB3D` (Axis Aligned Bounding Box 3D)
- Expressions: `BBoxBack`, `BBoxFront`, `BBoxMidZ`
- 3D shape supports `Origin Z` and negative depth

For proper 3D frustum culling, use `getBoundingBox3d()` rather than just setting `depth`, `width`, `height`.

## Construct 3 Plugin Conventions

### ACE Return Values

When expressions return lists or arrays, **always use JSON format**:

```typescript
// GOOD - Use JSON.stringify for array returns
_getMeshNames(): string {
    const names = this._model?.getMeshNames() ?? [];
    return JSON.stringify(names);
}
```

### ACE Naming Patterns

- Conditions: `Is<Something>` or `On<Event>`
- Actions: `Set<Property>`, `Enable<Thing>`, `Disable<Thing>`
- Expressions: `<PropertyName>` (PascalCase)

## Build Commands

```bash
npm run build           # Build all packages
npm run build:static    # Build gltf-static only
npm run build:spotlight # Build gltf-spotlight only
npm run build:environment # Build gltf-environment only
```

## Package Structure

```
gltf-plugins/
├── package.json              # Workspace config
├── tsconfig.base.json        # Shared TS config
├── CLAUDE.md                 # This file
└── packages/
    ├── shared-types/         # EditorSpotlight, EditorEnvironment interfaces
    ├── gltf-static/          # Main 3D model plugin (see LIGHTING.md)
    ├── gltf-spotlight/       # Spotlight addon
    └── gltf-environment/     # Environment lighting addon
```
