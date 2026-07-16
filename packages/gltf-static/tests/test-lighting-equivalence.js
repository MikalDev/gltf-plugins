// tests/test-lighting-equivalence.js
// Verifies the main thread and the worker light vertices IDENTICALLY:
//   1. Lighting.ts -> calculateMeshLighting()  (main thread; builds a config from globalThis)
//   2. the GENERATED worker blob source        (worker; receives a config snapshot)
//
// Both now route through the single implementation in LightingCore.ts, but they
// reach it very differently: the main thread calls it directly, while the worker
// runs a build-time-compiled COPY OF THE SOURCE TEXT injected into a Blob. This
// test evaluates the real generated artifact (c3runtime/gltf/generated/
// lightingWorkerCode.ts, produced by build.js) exactly as the worker would, so it
// catches both math drift and build/config-plumbing mistakes.
//
// This previously failed on all vertex-color blend modes: the worker carried a
// hand-mirrored copy of the equation that silently dropped sourceColors, so a
// mesh coloured by material baseColorFactor rendered washed out on worker paths.
//
// Regenerate the artifact with `npm run build` before running if LightingCore.ts changed.
//
// Run: node tests/test-lighting-equivalence.js

const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

let testsPassed = 0;
let testsFailed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    testsPassed++;
  } catch (e) {
    console.log(`  ✗ ${name}`);
    console.log(`    ${e.message}`);
    testsFailed++;
  }
}

// ---------------------------------------------------------------------------
// Load implementation 1: the real Lighting.ts
// ---------------------------------------------------------------------------

const lightingSourcePath = path.join(__dirname, '../c3runtime/gltf/Lighting.ts');

const lightingBuild = esbuild.buildSync({
  entryPoints: [lightingSourcePath],
  bundle: true,
  format: 'cjs',
  platform: 'node',
  write: false,
  target: 'es2021'
});

const lightingModule = { exports: {} };
new Function('module', 'exports', 'require', lightingBuild.outputFiles[0].text)(
  lightingModule, lightingModule.exports, require
);
const { calculateMeshLighting } = lightingModule.exports;

// ---------------------------------------------------------------------------
// Load implementation 2: the REAL generated worker blob source.
//
// build.js compiles LightingCore.ts to an IIFE and emits it as a string constant.
// TransformWorkerPool prepends that string to the worker body and hands the whole
// thing to a Blob. Here we evaluate that same string the way the worker would.
// ---------------------------------------------------------------------------

const generatedPath = path.join(__dirname, '../c3runtime/gltf/generated/lightingWorkerCode.ts');

if (!fs.existsSync(generatedPath)) {
  console.error(`\nMissing generated worker code: ${generatedPath}`);
  console.error('Run `npm run build` first.\n');
  process.exit(1);
}

const generatedBuild = esbuild.buildSync({
  entryPoints: [generatedPath],
  bundle: true,
  format: 'cjs',
  platform: 'node',
  write: false,
  target: 'es2021'
});

const generatedModule = { exports: {} };
new Function('module', 'exports', 'require', generatedBuild.outputFiles[0].text)(
  generatedModule, generatedModule.exports, require
);
const { LIGHTING_WORKER_CODE } = generatedModule.exports;

// Evaluate the worker-side source text and pull out the global it defines.
const workerLightingCore = new Function(
  LIGHTING_WORKER_CODE + '\nreturn LightingCore;'
)();
const workerCalculateLightingInto = workerLightingCore.calculateLightingInto;

if (typeof workerCalculateLightingInto !== 'function') {
  throw new Error('Generated worker code did not expose LightingCore.calculateLightingInto');
}

// ---------------------------------------------------------------------------
// Test geometry: deterministic, varied normals (normalized), varied positions.
// ---------------------------------------------------------------------------

const VERTEX_COUNT = 8;

function makeGeometry() {
  const positions = new Float32Array(VERTEX_COUNT * 3);
  const normals = new Float32Array(VERTEX_COUNT * 3);
  for (let i = 0; i < VERTEX_COUNT; i++) {
    // Spread positions around the origin so spot/point falloff varies per vertex.
    positions[i * 3] = Math.sin(i * 1.1) * 3;
    positions[i * 3 + 1] = Math.cos(i * 0.7) * 3;
    positions[i * 3 + 2] = (i - VERTEX_COUNT / 2) * 0.8;
    // Varied, normalized normals so N.L spans positive and negative.
    let nx = Math.sin(i * 2.3), ny = Math.cos(i * 1.7), nz = Math.sin(i * 0.9 + 1);
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
    normals[i * 3] = nx / len;
    normals[i * 3 + 1] = ny / len;
    normals[i * 3 + 2] = nz / len;
  }
  return { positions, normals };
}

function makeSourceColors() {
  const c = new Float32Array(VERTEX_COUNT * 4);
  for (let i = 0; i < VERTEX_COUNT; i++) {
    c[i * 4] = 0.55;      // a distinctly "brown"-ish base color, like a
    c[i * 4 + 1] = 0.27;  // material baseColorFactor with no texture
    c[i * 4 + 2] = 0.07;
    c[i * 4 + 3] = 1;
  }
  return c;
}

const IDENTITY = new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
// Non-trivial model matrix: rotate ~30deg about Z, scale 1.5, translate.
const MODEL_MATRIX = new Float32Array([
  1.2990, 0.7500, 0, 0,
  -0.7500, 1.2990, 0, 0,
  0, 0, 1.5, 0,
  4, -2, 1.5, 1
]);

// ---------------------------------------------------------------------------
// Scenario -> globalThis (for main thread) and -> lightConfig (for worker)
// ---------------------------------------------------------------------------

const DEFAULTS = {
  ambient: [0.1, 0.1, 0.12],
  lights: [],
  spotLights: [],
  hemisphere: { enabled: false, skyColor: [0.8, 0.9, 1.0], groundColor: [0.2, 0.15, 0.1], intensity: 1.0 },
  specular: { shininess: 32, intensity: 0, debugBlue: false },
  cameraPosition: null,
  matrix: null,
  sourceColors: null,
  colorBlendMode: 'none'
};

function applyToGlobals(s) {
  globalThis.gltfAmbientLight = new Float32Array(s.ambient);
  globalThis.gltfLights = s.lights.map(l => ({
    enabled: l.enabled,
    color: new Float32Array(l.color),
    intensity: l.intensity,
    direction: new Float32Array(l.direction),
    specularEnabled: l.specularEnabled
  }));
  globalThis.gltfSpotLights = s.spotLights.map(sp => ({ ...sp,
    color: new Float32Array(sp.color),
    position: new Float32Array(sp.position),
    direction: new Float32Array(sp.direction)
  }));
  globalThis.gltfHemisphereLight = {
    enabled: s.hemisphere.enabled,
    skyColor: new Float32Array(s.hemisphere.skyColor),
    groundColor: new Float32Array(s.hemisphere.groundColor),
    intensity: s.hemisphere.intensity
  };
  globalThis.gltfSpecular = { ...s.specular };
  globalThis.gltfColorBlendMode = s.colorBlendMode;
}

// Mirrors what instance.ts _buildLightConfig() posts to the worker.
function toWorkerConfig(s) {
  return {
    ambient: new Float32Array(s.ambient),
    colorBlendMode: s.colorBlendMode,
    lights: s.lights.map(l => ({ ...l })),
    spotLights: s.spotLights.map(sp => ({ ...sp })),
    hemisphere: { ...s.hemisphere },
    specular: { ...s.specular },
    cameraPosition: s.cameraPosition ? new Float32Array(s.cameraPosition) : undefined
  };
}

function compare(scenario) {
  const s = { ...DEFAULTS, ...scenario };
  const { positions, normals } = makeGeometry();

  applyToGlobals(s);
  const mainOut = new Float32Array(VERTEX_COUNT * 4);
  calculateMeshLighting(
    positions, normals, mainOut, VERTEX_COUNT,
    s.matrix, s.cameraPosition ? new Float32Array(s.cameraPosition) : null, s.sourceColors
  );

  const workerOut = new Float32Array(VERTEX_COUNT * 4);
  workerCalculateLightingInto(
    positions, normals, workerOut,
    0, 0, 0, VERTEX_COUNT,
    s.matrix, s.sourceColors, toWorkerConfig(s)
  );

  for (let i = 0; i < mainOut.length; i++) {
    if (Math.abs(mainOut[i] - workerOut[i]) > 1e-6) {
      const v = Math.floor(i / 4);
      const ch = ['r', 'g', 'b', 'a'][i % 4];
      throw new Error(
        `Divergence at vertex ${v} channel ${ch}: main=${mainOut[i].toFixed(6)} worker=${workerOut[i].toFixed(6)}\n` +
        `      main  [v${v}]: ${Array.from(mainOut.slice(v * 4, v * 4 + 4)).map(n => n.toFixed(4)).join(', ')}\n` +
        `      worker[v${v}]: ${Array.from(workerOut.slice(v * 4, v * 4 + 4)).map(n => n.toFixed(4)).join(', ')}`
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

const DIR_LIGHT = {
  enabled: true, color: [1.0, 0.95, 0.9], intensity: 1.2,
  direction: [0.5773, 0.5773, 0.5773], specularEnabled: true
};

const SPOT_LIGHT = {
  enabled: true, color: [1.0, 0.8, 0.6], intensity: 2.0,
  position: [2, 2, 4], direction: [0, 0, -1],
  innerConeAngle: 0.3, outerConeAngle: 0.6, falloffExponent: 1.5,
  range: 20, specularEnabled: true, type: 'spot'
};

const POINT_LIGHT = { ...SPOT_LIGHT, type: 'point', position: [1, -1, 2] };

console.log('\n--- generated artifact ---');

// The generated file is committed so that tsc/watch/IDE work on a fresh clone.
// That makes staleness possible: edit LightingCore.ts, forget `npm run build`, and
// the worker silently keeps shipping the OLD lighting equation while the main
// thread uses the new one — re-creating exactly the drift this refactor removed.
test('generated worker code is up to date with LightingCore.ts', () => {
  const fresh = esbuild.buildSync({
    entryPoints: [path.join(__dirname, '../c3runtime/gltf/LightingCore.ts')],
    bundle: true,
    format: 'iife',
    globalName: 'LightingCore',
    platform: 'browser',
    target: 'es2021',
    write: false,
    minify: false
  }).outputFiles[0].text;

  if (fresh !== LIGHTING_WORKER_CODE) {
    throw new Error(
      'c3runtime/gltf/generated/lightingWorkerCode.ts is STALE.\n' +
      '      LightingCore.ts has changed since it was generated — run `npm run build`.'
    );
  }
});

console.log('\n--- lighting paths ---');

test('ambient only', () => compare({}));

test('directional light (diffuse)', () => compare({ lights: [DIR_LIGHT] }));

test('directional light + model matrix', () =>
  compare({ lights: [DIR_LIGHT], matrix: MODEL_MATRIX }));

test('directional light + specular', () =>
  compare({
    lights: [DIR_LIGHT], cameraPosition: [0, -10, 5],
    specular: { shininess: 32, intensity: 0.8, debugBlue: false }
  }));

test('disabled light contributes nothing', () =>
  compare({ lights: [{ ...DIR_LIGHT, enabled: false }] }));

test('hemisphere light', () =>
  compare({ hemisphere: { enabled: true, skyColor: [0.5, 0.7, 1.0], groundColor: [0.3, 0.2, 0.1], intensity: 0.8 } }));

test('spotlight (cone falloff + range)', () =>
  compare({ spotLights: [SPOT_LIGHT] }));

test('spotlight + model matrix', () =>
  compare({ spotLights: [SPOT_LIGHT], matrix: MODEL_MATRIX }));

test('point light (no cone attenuation)', () =>
  compare({ spotLights: [POINT_LIGHT] }));

test('point light with inverse-square falloff (range 0)', () =>
  compare({ spotLights: [{ ...POINT_LIGHT, range: 0 }] }));

test('spotlight + specular', () =>
  compare({
    spotLights: [SPOT_LIGHT], cameraPosition: [0, -10, 5],
    specular: { shininess: 16, intensity: 0.7, debugBlue: false }
  }));

test('everything at once', () =>
  compare({
    lights: [DIR_LIGHT], spotLights: [SPOT_LIGHT, POINT_LIGHT],
    hemisphere: { enabled: true, skyColor: [0.5, 0.7, 1.0], groundColor: [0.3, 0.2, 0.1], intensity: 0.6 },
    cameraPosition: [0, -10, 5],
    specular: { shininess: 32, intensity: 0.5, debugBlue: false },
    matrix: MODEL_MATRIX
  }));

console.log('\n--- vertex colors / baseColorFactor ---');

for (const mode of ['none', 'multiply', 'screen', 'overlay', 'add']) {
  test(`vertex colors, blend mode "${mode}"`, () =>
    compare({
      lights: [DIR_LIGHT],
      sourceColors: makeSourceColors(),
      colorBlendMode: mode
    }));
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log('\n=== Test Summary (test-lighting-equivalence.js) ===\n');
console.log(`  Passed: ${testsPassed}`);
console.log(`  Failed: ${testsFailed}`);
console.log('');

if (testsFailed > 0) {
  console.log('TESTS FAILED\n');
  process.exit(1);
} else {
  console.log('ALL TESTS PASSED\n');
}
