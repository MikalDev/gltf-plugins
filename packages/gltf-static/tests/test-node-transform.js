// tests/test-node-transform.js
// Regression test for double-transform of baked static meshes in mixed
// skinned/non-skinned glTF models.
//
// Part 1: sanity-checks GltfNode's parent/child world-matrix hierarchy
//         (compiled from the actual GltfNode.ts source via esbuild).
// Part 2: extracts the ACTUAL updateStaticMeshTransforms() method body from
//         GltfModel.ts and runs it against lightweight stub meshes, asserting
//         that baked meshes (no animated ancestor) are skipped while
//         local-kept meshes (animated ancestor) are node-transformed.
//
// Run: node tests/test-node-transform.js

const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

function assertArraysEqual(actual, expected, message, epsilon = 0.0001) {
  if (actual.length !== expected.length) {
    throw new Error(`${message || 'Arrays not equal'} (length mismatch: ${actual.length} vs ${expected.length})`);
  }
  for (let i = 0; i < actual.length; i++) {
    if (Math.abs(actual[i] - expected[i]) > epsilon) {
      throw new Error(`${message || 'Arrays not equal'}\n      Expected: [${Array.from(expected).join(', ')}]\n      Actual:   [${Array.from(actual).join(', ')}]`);
    }
  }
}

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    testsPassed++;
  } catch (e) {
    console.log(`  ✗ ${name}`);
    console.log(`    Error: ${e.message}`);
    testsFailed++;
  }
}

// ---------------------------------------------------------------------------
// Part 1: Compile the actual GltfNode.ts and sanity-check the hierarchy.
// ---------------------------------------------------------------------------

const nodeSourcePath = path.join(__dirname, '../c3runtime/gltf/GltfNode.ts');

const nodeBuildResult = esbuild.buildSync({
  entryPoints: [nodeSourcePath],
  bundle: true,
  format: 'cjs',
  platform: 'node',
  write: false,
  target: 'es2021'
});

const nodeModuleCode = nodeBuildResult.outputFiles[0].text;
const nodeModule = { exports: {} };
new Function('module', 'exports', 'require', nodeModuleCode)(nodeModule, nodeModule.exports, require);
const { GltfNode } = nodeModule.exports;

function makeMat4Translate(x, y, z) {
  // column-major 4x4, identity + translation
  return new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    x, y, z, 1
  ]);
}

function makeMat4Scale(s) {
  return new Float32Array([
    s, 0, 0, 0,
    0, s, 0, 0,
    0, 0, s, 0,
    0, 0, 0, 1
  ]);
}

function mat4MultiplyRef(a, b) {
  // a * b, column-major, matches gl-matrix mat4.multiply(out, a, b)
  const out = new Float32Array(16);
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) {
        sum += a[k * 4 + row] * b[col * 4 + k];
      }
      out[col * 4 + row] = sum;
    }
  }
  return out;
}

test('GltfNode: world matrix = parent world * local (no parent)', () => {
  const root = new GltfNode('root', makeMat4Translate(5, 0, 0));
  assertArraysEqual(root.getWorldMatrix(), makeMat4Translate(5, 0, 0), 'Root world matrix should equal its local matrix');
});

test('GltfNode: world matrix = parent world * local (with parent)', () => {
  const parent = new GltfNode('parent', makeMat4Translate(10, 0, 0));
  const child = new GltfNode('child', makeMat4Scale(2));
  parent.addChild(child);

  const expected = mat4MultiplyRef(makeMat4Translate(10, 0, 0), makeMat4Scale(2));
  assertArraysEqual(child.getWorldMatrix(), expected, 'Child world matrix should be parent * local');
});

test('GltfNode: invalidate()/setLocalMatrix propagates to children', () => {
  const parent = new GltfNode('parent', makeMat4Translate(0, 0, 0));
  const child = new GltfNode('child', makeMat4Translate(1, 1, 1));
  parent.addChild(child);

  // Prime the cached world matrices
  child.getWorldMatrix();

  // Move the parent - child's cached world matrix must be invalidated too
  parent.setLocalMatrix(makeMat4Translate(100, 0, 0));

  const expected = mat4MultiplyRef(makeMat4Translate(100, 0, 0), makeMat4Translate(1, 1, 1));
  assertArraysEqual(child.getWorldMatrix(), expected, 'Child world matrix should reflect parent update after invalidate()');
});

test('GltfNode: hasAnimatedAncestor() walks up the chain', () => {
  const grandparent = new GltfNode('gp', makeMat4Translate(0, 0, 0));
  const parent = new GltfNode('p', makeMat4Translate(0, 0, 0));
  const child = new GltfNode('c', makeMat4Translate(0, 0, 0));
  grandparent.addChild(parent);
  parent.addChild(child);

  assert(child.hasAnimatedAncestor() === false, 'No joint in chain -> false');

  grandparent.jointIndex = 0;
  assert(child.hasAnimatedAncestor() === true, 'Joint ancestor found -> true');
});

// ---------------------------------------------------------------------------
// Part 2: Extract the ACTUAL updateStaticMeshTransforms() method body from
// GltfModel.ts and exercise the baked-vs-local-kept mesh selection logic.
// ---------------------------------------------------------------------------

const modelSourcePath = path.join(__dirname, '../c3runtime/gltf/GltfModel.ts');
const modelSource = fs.readFileSync(modelSourcePath, 'utf8');

function extractMethodBody(source, signatureRegex) {
  const sigMatch = source.match(signatureRegex);
  if (!sigMatch) {
    throw new Error(`Could not find method signature matching ${signatureRegex}`);
  }
  const openBraceIndex = sigMatch.index + sigMatch[0].length - 1; // signature capture ends with '{'
  assert(source[openBraceIndex] === '{', 'Expected signature match to end at opening brace');

  let depth = 0;
  let i = openBraceIndex;
  for (; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth--;
      if (depth === 0) break;
    }
  }
  // Body excludes the outer braces
  return source.slice(openBraceIndex + 1, i);
}

const methodBody = extractMethodBody(
  modelSource,
  /updateStaticMeshTransforms\(instanceMatrix\?: Float32Array, cameraPosition\?: Float32Array \| null\): void \{/
);

// Wrap the extracted body into a callable function. The body references
// `this._meshes`, so it must be invoked with .call(ctx, ...).
const updateStaticMeshTransforms = new Function('instanceMatrix', 'cameraPosition', methodBody);

function makeStubMesh({ isSkinned, hasAnimatedAncestor, hasParent = true }) {
  const calls = { updateNodeTransform: [], applyLighting: [] };
  return {
    isSkinned,
    parentNode: hasParent ? { hasAnimatedAncestor: () => hasAnimatedAncestor } : null,
    updateNodeTransform(instanceMatrix) { calls.updateNodeTransform.push(instanceMatrix); },
    applyLighting(a, b, cameraPosition) { calls.applyLighting.push(cameraPosition); },
    _calls: calls
  };
}

test('updateStaticMeshTransforms: baked mesh (no animated ancestor) is skipped', () => {
  const bakedMesh = makeStubMesh({ isSkinned: false, hasAnimatedAncestor: false });
  const ctx = { _meshes: [bakedMesh] };
  const instanceMatrix = new Float32Array(16);
  const cameraPosition = new Float32Array(3);

  updateStaticMeshTransforms.call(ctx, instanceMatrix, cameraPosition);

  assert(bakedMesh._calls.updateNodeTransform.length === 0, 'Baked mesh must NOT be node-transformed (already includes node world matrix in _originalPositions)');
  assert(bakedMesh._calls.applyLighting.length === 0, 'Baked mesh must NOT get main-thread lighting applied here');
});

test('updateStaticMeshTransforms: local-kept mesh (animated ancestor) is node-transformed with instance matrix', () => {
  const localKeptMesh = makeStubMesh({ isSkinned: false, hasAnimatedAncestor: true });
  const ctx = { _meshes: [localKeptMesh] };
  const instanceMatrix = new Float32Array(16);
  instanceMatrix[0] = 42; // sentinel to verify identity is passed through
  const cameraPosition = new Float32Array(3);

  updateStaticMeshTransforms.call(ctx, instanceMatrix, cameraPosition);

  assert(localKeptMesh._calls.updateNodeTransform.length === 1, 'Local-kept mesh must be node-transformed exactly once');
  assert(localKeptMesh._calls.updateNodeTransform[0] === instanceMatrix, 'Local-kept mesh must receive the instance matrix (not undefined)');
  assert(localKeptMesh._calls.applyLighting.length === 1, 'Local-kept mesh must get main-thread lighting applied');
  assert(localKeptMesh._calls.applyLighting[0] === cameraPosition, 'Lighting call should receive the camera position');
});

test('updateStaticMeshTransforms: skinned meshes are always skipped', () => {
  const skinnedBaked = makeStubMesh({ isSkinned: true, hasAnimatedAncestor: false });
  const skinnedLocal = makeStubMesh({ isSkinned: true, hasAnimatedAncestor: true });
  const ctx = { _meshes: [skinnedBaked, skinnedLocal] };

  updateStaticMeshTransforms.call(ctx, new Float32Array(16), null);

  assert(skinnedBaked._calls.updateNodeTransform.length === 0, 'Skinned mesh (baked) must never be node-transformed here');
  assert(skinnedLocal._calls.updateNodeTransform.length === 0, 'Skinned mesh (local-kept) must never be node-transformed here');
});

test('updateStaticMeshTransforms: meshes without a parent node are skipped', () => {
  const orphanMesh = makeStubMesh({ isSkinned: false, hasAnimatedAncestor: true, hasParent: false });
  const ctx = { _meshes: [orphanMesh] };

  updateStaticMeshTransforms.call(ctx, new Float32Array(16), null);

  assert(orphanMesh._calls.updateNodeTransform.length === 0, 'Mesh with no parentNode must be skipped');
});

test('updateStaticMeshTransforms: mixed model only transforms local-kept mesh, leaves baked mesh alone', () => {
  const bakedMesh = makeStubMesh({ isSkinned: false, hasAnimatedAncestor: false });
  const localKeptMesh = makeStubMesh({ isSkinned: false, hasAnimatedAncestor: true });
  const skinnedMesh = makeStubMesh({ isSkinned: true, hasAnimatedAncestor: false });
  const ctx = { _meshes: [bakedMesh, localKeptMesh, skinnedMesh] };
  const instanceMatrix = new Float32Array(16);

  updateStaticMeshTransforms.call(ctx, instanceMatrix, new Float32Array(3));

  assert(bakedMesh._calls.updateNodeTransform.length === 0, 'Baked mesh skipped in mixed model');
  assert(localKeptMesh._calls.updateNodeTransform.length === 1, 'Local-kept mesh transformed in mixed model');
  assert(skinnedMesh._calls.updateNodeTransform.length === 0, 'Skinned mesh skipped in mixed model');
});

// ---------------------------------------------------------------------------
// Part 3: Extract the ACTUAL _registerStaticMeshesForLightingWithPool() method
// body from GltfModel.ts and verify that LOCAL-KEPT meshes (non-skinned with
// an animated ancestor) are excluded from worker static registration, since
// they are transformed+lit entirely on the main thread by
// updateStaticMeshTransforms().
// ---------------------------------------------------------------------------

// debugLog is a free variable (module-level function in GltfModel.ts) referenced
// unqualified inside the extracted method body; provide it as a global stub so
// the body can resolve it when invoked outside the module.
global.debugLog = function () {};

const registerMethodBody = extractMethodBody(
  modelSource,
  /private _registerStaticMeshesForLightingWithPool\(\): void \{/
);

const registerStaticMeshesForLightingWithPool = new Function(registerMethodBody);

function makeRegistrationStubMesh({ isSkinned, hasNormals, parentNode }) {
  let registered = false;
  return {
    isSkinned,
    hasNormals,
    parentNode,
    registerStaticLightingWithPool() { registered = true; },
    get isRegisteredStaticLightingWithPool() { return registered; }
  };
}

test('_registerStaticMeshesForLightingWithPool: baked mesh (no animated ancestor) IS registered', () => {
  const bakedMesh = makeRegistrationStubMesh({
    isSkinned: false,
    hasNormals: true,
    parentNode: { hasAnimatedAncestor: () => false }
  });
  const ctx = { _workerPool: {}, _meshes: [bakedMesh] };

  registerStaticMeshesForLightingWithPool.call(ctx);

  assert(bakedMesh.isRegisteredStaticLightingWithPool === true, 'Baked mesh must be registered with the worker static pool');
});

test('_registerStaticMeshesForLightingWithPool: LOCAL-KEPT mesh (animated ancestor) is NOT registered', () => {
  const localKeptMesh = makeRegistrationStubMesh({
    isSkinned: false,
    hasNormals: true,
    parentNode: { hasAnimatedAncestor: () => true }
  });
  const ctx = { _workerPool: {}, _meshes: [localKeptMesh] };

  registerStaticMeshesForLightingWithPool.call(ctx);

  assert(localKeptMesh.isRegisteredStaticLightingWithPool === false, 'LOCAL-KEPT mesh must NOT be registered with the worker static pool (handled main-thread)');
});

test('_registerStaticMeshesForLightingWithPool: skinned mesh is NOT registered', () => {
  const skinnedMesh = makeRegistrationStubMesh({
    isSkinned: true,
    hasNormals: true,
    parentNode: { hasAnimatedAncestor: () => false }
  });
  const ctx = { _workerPool: {}, _meshes: [skinnedMesh] };

  registerStaticMeshesForLightingWithPool.call(ctx);

  assert(skinnedMesh.isRegisteredStaticLightingWithPool === false, 'Skinned mesh must NOT be registered with the worker static pool');
});

test('_registerStaticMeshesForLightingWithPool: mesh with no normals is NOT registered', () => {
  const noNormalsMesh = makeRegistrationStubMesh({
    isSkinned: false,
    hasNormals: false,
    parentNode: { hasAnimatedAncestor: () => false }
  });
  const ctx = { _workerPool: {}, _meshes: [noNormalsMesh] };

  registerStaticMeshesForLightingWithPool.call(ctx);

  assert(noNormalsMesh.isRegisteredStaticLightingWithPool === false, 'Mesh without normals must NOT be registered with the worker static pool');
});

test('_registerStaticMeshesForLightingWithPool: mesh with no parentNode IS registered (optional chaining)', () => {
  const orphanMesh = makeRegistrationStubMesh({
    isSkinned: false,
    hasNormals: true,
    parentNode: null
  });
  const ctx = { _workerPool: {}, _meshes: [orphanMesh] };

  registerStaticMeshesForLightingWithPool.call(ctx);

  assert(orphanMesh.isRegisteredStaticLightingWithPool === true, 'Mesh without a parentNode must still be registered (baked, no ancestor to check)');
});

test('_registerStaticMeshesForLightingWithPool: mixed model registers only the baked mesh', () => {
  const bakedMesh = makeRegistrationStubMesh({
    isSkinned: false,
    hasNormals: true,
    parentNode: { hasAnimatedAncestor: () => false }
  });
  const localKeptMesh = makeRegistrationStubMesh({
    isSkinned: false,
    hasNormals: true,
    parentNode: { hasAnimatedAncestor: () => true }
  });
  const skinnedMesh = makeRegistrationStubMesh({
    isSkinned: true,
    hasNormals: true,
    parentNode: { hasAnimatedAncestor: () => false }
  });
  const ctx = { _workerPool: {}, _meshes: [bakedMesh, localKeptMesh, skinnedMesh] };

  registerStaticMeshesForLightingWithPool.call(ctx);

  assert(bakedMesh.isRegisteredStaticLightingWithPool === true, 'Baked mesh registered in mixed model');
  assert(localKeptMesh.isRegisteredStaticLightingWithPool === false, 'LOCAL-KEPT mesh not registered in mixed model');
  assert(skinnedMesh.isRegisteredStaticLightingWithPool === false, 'Skinned mesh not registered in mixed model');
});

test('_registerStaticMeshesForLightingWithPool: no-op when there is no worker pool', () => {
  const bakedMesh = makeRegistrationStubMesh({
    isSkinned: false,
    hasNormals: true,
    parentNode: { hasAnimatedAncestor: () => false }
  });
  const ctx = { _workerPool: null, _meshes: [bakedMesh] };

  registerStaticMeshesForLightingWithPool.call(ctx);

  assert(bakedMesh.isRegisteredStaticLightingWithPool === false, 'Nothing should register when _workerPool is falsy');
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log('\n=== Test Summary (test-node-transform.js) ===\n');
console.log(`  Passed: ${testsPassed}`);
console.log(`  Failed: ${testsFailed}`);
console.log('');

if (testsFailed > 0) {
  console.log('TESTS FAILED\n');
  process.exit(1);
} else {
  console.log('ALL TESTS PASSED\n');
}
