// tests/test-node-transform.js
// Covers GltfNode's world-matrix hierarchy and the worker-pool static-mesh
// registration rule now that rigid meshes under animated joints are
// converted to 1-bone skinned meshes at load time (so _originalPositions is
// always model-space / node-world-baked for every non-skinned mesh).
//
// Part 1: sanity-checks GltfNode's parent/child world-matrix hierarchy
//         (compiled from the actual GltfNode.ts source via esbuild).
// Part 2: extracts the ACTUAL _registerStaticMeshesForLightingWithPool()
//         method body from GltfModel.ts and verifies the selection rule is
//         simply `!isSkinned && hasNormals` — animated-ancestor status no
//         longer matters, since such meshes are now skinned and excluded by
//         the isSkinned check.
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
// Part 2: Extract the ACTUAL _registerStaticMeshesForLightingWithPool() method
// body from GltfModel.ts and verify the current selection rule: a mesh
// registers with the worker static-lighting pool iff `!isSkinned &&
// hasNormals`. Animated-ancestor status is irrelevant now — rigid meshes
// under animated joints are converted to 1-bone skinned meshes at load time
// and are therefore excluded by the isSkinned check already.
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

// debugLog is a free variable (module-level function in GltfModel.ts) referenced
// unqualified inside the extracted method body; provide it as a global stub so
// the body can resolve it when invoked outside the module.
global.debugLog = function () {};

const registerMethodBody = extractMethodBody(
  modelSource,
  /private _registerStaticMeshesForLightingWithPool\(\): void \{/
);

const registerStaticMeshesForLightingWithPool = new Function(registerMethodBody);

function makeRegistrationStubMesh({ isSkinned, hasNormals, parentNode = null }) {
  let registered = false;
  return {
    isSkinned,
    hasNormals,
    parentNode,
    registerStaticLightingWithPool() { registered = true; },
    get isRegisteredStaticLightingWithPool() { return registered; }
  };
}

test('_registerStaticMeshesForLightingWithPool: non-skinned mesh with normals IS registered', () => {
  const mesh = makeRegistrationStubMesh({ isSkinned: false, hasNormals: true });
  const ctx = { _workerPool: {}, _meshes: [mesh] };

  registerStaticMeshesForLightingWithPool.call(ctx);

  assert(mesh.isRegisteredStaticLightingWithPool === true, 'Non-skinned mesh with normals must be registered with the worker static pool');
});

test('_registerStaticMeshesForLightingWithPool: registers regardless of animated ancestor (converted meshes are already skinned)', () => {
  // A mesh with an animated-ancestor parentNode but isSkinned:false represents
  // a case that should no longer occur post-load-time-conversion, but the
  // registration rule itself must not special-case it -- selection is purely
  // !isSkinned && hasNormals.
  const mesh = makeRegistrationStubMesh({
    isSkinned: false,
    hasNormals: true,
    parentNode: { hasAnimatedAncestor: () => true }
  });
  const ctx = { _workerPool: {}, _meshes: [mesh] };

  registerStaticMeshesForLightingWithPool.call(ctx);

  assert(mesh.isRegisteredStaticLightingWithPool === true, 'Registration must not depend on hasAnimatedAncestor() anymore');
});

test('_registerStaticMeshesForLightingWithPool: skinned mesh is NOT registered', () => {
  const skinnedMesh = makeRegistrationStubMesh({ isSkinned: true, hasNormals: true });
  const ctx = { _workerPool: {}, _meshes: [skinnedMesh] };

  registerStaticMeshesForLightingWithPool.call(ctx);

  assert(skinnedMesh.isRegisteredStaticLightingWithPool === false, 'Skinned mesh must NOT be registered with the worker static pool');
});

test('_registerStaticMeshesForLightingWithPool: mesh with no normals is NOT registered', () => {
  const noNormalsMesh = makeRegistrationStubMesh({ isSkinned: false, hasNormals: false });
  const ctx = { _workerPool: {}, _meshes: [noNormalsMesh] };

  registerStaticMeshesForLightingWithPool.call(ctx);

  assert(noNormalsMesh.isRegisteredStaticLightingWithPool === false, 'Mesh without normals must NOT be registered with the worker static pool');
});

test('_registerStaticMeshesForLightingWithPool: mesh with no parentNode IS registered', () => {
  const orphanMesh = makeRegistrationStubMesh({ isSkinned: false, hasNormals: true, parentNode: null });
  const ctx = { _workerPool: {}, _meshes: [orphanMesh] };

  registerStaticMeshesForLightingWithPool.call(ctx);

  assert(orphanMesh.isRegisteredStaticLightingWithPool === true, 'Mesh without a parentNode must still be registered');
});

test('_registerStaticMeshesForLightingWithPool: mixed model registers non-skinned meshes with normals only', () => {
  const staticMesh = makeRegistrationStubMesh({ isSkinned: false, hasNormals: true });
  const noNormalsMesh = makeRegistrationStubMesh({ isSkinned: false, hasNormals: false });
  const skinnedMesh = makeRegistrationStubMesh({ isSkinned: true, hasNormals: true });
  const ctx = { _workerPool: {}, _meshes: [staticMesh, noNormalsMesh, skinnedMesh] };

  registerStaticMeshesForLightingWithPool.call(ctx);

  assert(staticMesh.isRegisteredStaticLightingWithPool === true, 'Static mesh with normals registered in mixed model');
  assert(noNormalsMesh.isRegisteredStaticLightingWithPool === false, 'Mesh without normals not registered in mixed model');
  assert(skinnedMesh.isRegisteredStaticLightingWithPool === false, 'Skinned mesh not registered in mixed model');
});

test('_registerStaticMeshesForLightingWithPool: no-op when there is no worker pool', () => {
  const mesh = makeRegistrationStubMesh({ isSkinned: false, hasNormals: true });
  const ctx = { _workerPool: null, _meshes: [mesh] };

  registerStaticMeshesForLightingWithPool.call(ctx);

  assert(mesh.isRegisteredStaticLightingWithPool === false, 'Nothing should register when _workerPool is falsy');
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
