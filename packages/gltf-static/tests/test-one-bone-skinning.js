// tests/test-one-bone-skinning.js
//
// Proves (or disproves) the mathematical claim that a rigid (non-skinned)
// mesh parented under an animated joint, converted at load time into a
// 1-bone skinned mesh with weight 1.0 on that joint, reproduces the correct
// runtime position for any runtime joint pose -- PROVIDED it is baked with
// the right bind-space math.
//
// -----------------------------------------------------------------------
// THREE POSES, NOT TWO
// -----------------------------------------------------------------------
// A real glTF model (see tests/cleric.gltf investigation) has THREE distinct
// joint poses, not two:
//   - BIND pose:    what the inverseBindMatrices (IBM) encode.
//   - REST pose:    what the scene node's TRS values encode (i.e. what
//                    GltfNode.getWorldMatrix() computes from the loaded
//                    hierarchy before any animation runs).
//   - RUNTIME pose: the animated pose at the moment of skinning.
//
// A previous version of this test silently assumed BIND == REST -- it built
// the "bind" hierarchy and the mesh bake from the SAME node tree. That is
// exactly the assumption real-world models violate: measuring the actual
// cleric.gltf model showed `sceneJointWorld_rest x IBM != identity` for 27 of
// 32 joints (e.g. "Weapon.R" has a ~79 degree rotation + translation(1.44,
// 1.81, -0.22) residual between rest and bind). A test that cannot fail on
// that mismatch is worse than no test, so this version models all three
// poses explicitly and cannot silently assume bind == rest.
//
// -----------------------------------------------------------------------
// THE CLAIM (general, rest may differ from bind)
// -----------------------------------------------------------------------
//   IBM_j          = inverse(jointWorld_BIND_j)
//   baked          = inverse(IBM_j) x inverse(jointWorld_REST_j) x nodeWorld_REST x v_local
//                   (take the mesh's rest-pose world position, express it
//                    relative to the joint's REST pose, then re-place it
//                    relative to the joint's BIND pose -- inverse(IBM_j) IS
//                    the joint's true bind world matrix)
//   boneMatrix     = jointWorld_RUNTIME_j x IBM_j
//   v_skinned      = boneMatrix x baked
//   =>  v_skinned == nodeWorld_RUNTIME x v_local   for any runtime joint pose
//
// When REST == BIND, `inverse(jointWorld_REST_j)` and `inverse(IBM_j)`
// cancel to identity and `baked` collapses to the OLD formula
// (`nodeWorld_REST x v_local`) exactly -- so the new formula is a strict
// generalisation, not a replacement. This file proves both directions:
//   1. The new formula holds when REST == BIND (old cases still pass).
//   2. The new formula holds when REST != BIND (the real-world case).
//   3. The OLD formula (baked = nodeWorld_REST, ignoring bind entirely)
//      FAILS when REST != BIND -- an explicit regression guard so this bug
//      can never silently reappear.
//
// This test does NOT hand-write any skinning or hierarchy math itself.
// - LEFT side (skinning): the ACTUAL skinMeshInto() extracted verbatim out of
//   the WORKER_CODE template literal in c3runtime/gltf/TransformWorkerPool.ts.
// - RIGHT side (reference): the ACTUAL GltfNode from c3runtime/gltf/GltfNode.ts,
//   compiled with esbuild, used to build real REST and RUNTIME node
//   hierarchies and read out real getWorldMatrix() results. BIND is supplied
//   directly as a matrix (mirroring how an IBM is authored data, not
//   something derived from the loaded scene graph).
//
// The only hand-written math here is plain vec3/mat4 arithmetic used to
// apply/compose matrices already produced by production code or supplied as
// test fixtures -- that is not skinning logic, just "multiply this vector /
// matrix by that one", using gl-matrix (an existing dependency).
//
// Run: node tests/test-one-bone-skinning.js

const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');
const { mat4, vec3, quat } = require('gl-matrix');

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

// Float32 accumulation happens throughout (GltfNode's world matrices are
// Float32Array, and skinMeshInto reads/writes Float32Array buffers), and the
// reference side chains several mat4 multiplies/inverses. 1e-4 is generous
// enough to absorb that float32 error while still being far tighter than any
// bug-sized discrepancy we're hunting for (a wrong bind/rest reconciliation
// is off by whole units or tens of degrees, not 1e-4).
const EPS = 1e-4;

function vec3Close(a, b, eps = EPS) {
  return Math.abs(a[0] - b[0]) <= eps && Math.abs(a[1] - b[1]) <= eps && Math.abs(a[2] - b[2]) <= eps;
}

function fmtVec3(v) {
  return `[${Array.from(v).map(n => n.toFixed(6)).join(', ')}]`;
}

function assertVec3Close(actual, expected, message) {
  if (!vec3Close(actual, expected)) {
    throw new Error(
      `${message || 'vec3 mismatch'}\n      Expected: ${fmtVec3(expected)}\n      Actual:   ${fmtVec3(actual)}`
    );
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
// Extract the ACTUAL skinMeshInto() from the WORKER_CODE template literal in
// TransformWorkerPool.ts. Locate the signature, then bracket-match the body.
// ---------------------------------------------------------------------------

const poolSourcePath = path.join(__dirname, '../c3runtime/gltf/TransformWorkerPool.ts');
const poolSource = fs.readFileSync(poolSourcePath, 'utf8');

function extractFunctionSource(source, signatureRegex) {
  const sigMatch = source.match(signatureRegex);
  if (!sigMatch) {
    throw new Error(`Could not find function signature matching ${signatureRegex}`);
  }
  const openBraceIndex = sigMatch.index + sigMatch[0].length - 1;
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
  // Include the signature + full body (with braces) so it's a complete,
  // directly-evaluable function declaration.
  return source.slice(sigMatch.index, i + 1);
}

const skinMeshIntoSource = extractFunctionSource(
  poolSource,
  /function skinMeshInto\(origPositions, origNormals, outPositions, outNormals, offset, boneMatrices, joints, weights, vertexCount\) \{/
);

// skinMeshInto is self-contained (only uses its own params + Math), so it can
// be evaluated directly without any surrounding worker scaffolding.
const skinMeshInto = new Function(`return (${skinMeshIntoSource});`)();

assert(typeof skinMeshInto === 'function', 'Failed to extract skinMeshInto as a callable function');

// ---------------------------------------------------------------------------
// Compile the ACTUAL GltfNode.ts via esbuild (same pattern as
// tests/test-node-transform.js).
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
const nodeModule = { exports: {} };
new Function('module', 'exports', 'require', nodeBuildResult.outputFiles[0].text)(
  nodeModule, nodeModule.exports, require
);
const { GltfNode } = nodeModule.exports;

// ---------------------------------------------------------------------------
// Test harness helpers
// ---------------------------------------------------------------------------

function trs(translation, rotationEulerDeg, scale) {
  const q = quat.create();
  quat.fromEuler(q, rotationEulerDeg[0], rotationEulerDeg[1], rotationEulerDeg[2]);
  const m = mat4.create();
  mat4.fromRotationTranslationScale(m, q, translation, scale);
  return new Float32Array(m);
}

// Plain "multiply this vector by this matrix" - not skinning logic, just
// arithmetic to apply an already-computed matrix (from real GltfNode /
// gl-matrix code, or a composed test fixture) to a test vertex.
function transformPoint(matrix, v) {
  const out = vec3.create();
  vec3.transformMat4(out, v, matrix);
  return out;
}

function transformNormalUpper3x3(matrix, n) {
  // upper-left 3x3 only, no translation - matches how skinMeshInto handles
  // normals (direct 3x3 transform, then normalize).
  const x = n[0], y = n[1], z = n[2];
  const out = vec3.fromValues(
    matrix[0] * x + matrix[4] * y + matrix[8] * z,
    matrix[1] * x + matrix[5] * y + matrix[9] * z,
    matrix[2] * x + matrix[6] * y + matrix[10] * z
  );
  vec3.normalize(out, out);
  return out;
}

/**
 * Builds a node chain: root -> ... -> joint -> [intermediateNodes...] -> meshParent
 * using the supplied local matrices, and returns the built nodes keyed by name.
 *
 * chainSpec: array of { name, matrix, isJoint }, in root-to-leaf order.
 * The LAST entry in chainSpec is the mesh's direct parent node.
 */
function buildHierarchy(chainSpec) {
  const nodes = {};
  let parent = null;
  for (const spec of chainSpec) {
    const node = new GltfNode(spec.name, spec.matrix);
    if (spec.isJoint) node.jointIndex = 0;
    if (parent) parent.addChild(node);
    nodes[spec.name] = node;
    parent = node;
  }
  return nodes;
}

/** Builds a REST hierarchy and reads back the joint's rest-pose world matrix. */
function computeRestJointWorld(restChainSpec) {
  const nodes = buildHierarchy(restChainSpec);
  return new Float32Array(nodes['joint'].getWorldMatrix());
}

/**
 * Runs the skinning math (real skinMeshInto, single bone, weight 1.0) given
 * already-baked model-space positions/normals and a bone matrix, and compares
 * the result against nodeWorld_RUNTIME x v_local for every vertex.
 *
 * If expectMatch is true, throws (via assert) with a detailed diff on any
 * mismatch. If expectMatch is false, this is a REGRESSION check proving a
 * known-bad formula actually produces wrong output - it throws if the
 * (buggy) formula unexpectedly matches every vertex, i.e. if the regression
 * case failed to reproduce the bug.
 */
function skinAndCompare({ modelPositions, modelNormals, boneMatrix, localPositions, localNormals, meshParentWorldRuntime, expectMatch, label }) {
  const vertexCount = localPositions.length;
  const boneMatrices = new Float32Array(boneMatrix); // 16 floats, one bone

  const joints = new Uint16Array(vertexCount * 4); // all zero -> joint index 0 in slot 0
  const weights = new Float32Array(vertexCount * 4);
  for (let i = 0; i < vertexCount; i++) weights[i * 4] = 1.0; // weight 1.0 in slot 0, rest 0

  const outPositions = new Float32Array(vertexCount * 3);
  const outNormals = modelNormals ? new Float32Array(vertexCount * 3) : null;

  skinMeshInto(modelPositions, modelNormals, outPositions, outNormals, 0, boneMatrices, joints, weights, vertexCount);

  let allMatch = true;
  const mismatches = [];
  for (let i = 0; i < vertexCount; i++) {
    const expectedPos = transformPoint(meshParentWorldRuntime, localPositions[i]);
    const skinnedPos = outPositions.subarray(i * 3, i * 3 + 3);
    let posMatch = vec3Close(skinnedPos, expectedPos);

    let normMatch = true, expectedNormal = null, skinnedNormal = null;
    if (localNormals) {
      expectedNormal = transformNormalUpper3x3(meshParentWorldRuntime, localNormals[i]);
      skinnedNormal = outNormals.subarray(i * 3, i * 3 + 3);
      normMatch = vec3Close(skinnedNormal, expectedNormal);
    }

    if (!posMatch || !normMatch) {
      allMatch = false;
      mismatches.push({ i, skinnedPos: Array.from(skinnedPos), expectedPos: Array.from(expectedPos) });
    }
  }

  if (expectMatch) {
    if (!allMatch) {
      for (const m of mismatches) {
        console.log(`    [${label || 'case'}] Vertex ${m.i} position mismatch`);
        console.log(`      skinned:  ${fmtVec3(m.skinnedPos)}`);
        console.log(`      expected: ${fmtVec3(m.expectedPos)}`);
      }
    }
    assert(allMatch, `Expected skinned result to equal nodeWorld_runtime x v_local for every vertex${label ? ` (${label})` : ''}`);
  } else {
    if (allMatch) {
      console.log(`    [${label || 'case'}] UNEXPECTED: buggy formula matched the runtime target for every vertex`);
      console.log('      (this regression case failed to reproduce the bug -- it needs a bigger rest/bind gap)');
    } else {
      console.log(`    [${label || 'case'}] Confirmed mismatch (as expected) for ${mismatches.length}/${vertexCount} vertices, e.g.:`);
      const m = mismatches[0];
      console.log(`      skinned:  ${fmtVec3(m.skinnedPos)}`);
      console.log(`      expected: ${fmtVec3(m.expectedPos)}`);
    }
    assert(!allMatch, `Expected the OLD (buggy) bake formula to MISMATCH nodeWorld_runtime x v_local when rest != bind${label ? ` (${label})` : ''}`);
  }

  return { outPositions, outNormals };
}

/**
 * NEW (general) formula:
 *   IBM_j      = inverse(jointWorld_BIND_j)
 *   baked      = inverse(IBM_j) x inverse(jointWorld_REST_j) x nodeWorld_REST x v_local
 *   boneMatrix = jointWorld_RUNTIME_j x IBM_j
 * Asserts the skinned result equals nodeWorld_RUNTIME x v_local.
 *
 * jointWorldBindMatrix is supplied directly (mirrors how the IBM is data
 * baked into the glTF, independent of the loaded scene graph's REST pose).
 */
function runNewFormulaCheck({ restChainSpec, jointWorldBindMatrix, jointRuntimeMatrix, localPositions, localNormals, label }) {
  const meshParentName = restChainSpec[restChainSpec.length - 1].name;

  // --- REST hierarchy (this is the actual loaded scene graph) ---
  const restNodes = buildHierarchy(restChainSpec);
  const jointWorldRest = new Float32Array(restNodes['joint'].getWorldMatrix());
  const meshParentWorldRest = new Float32Array(restNodes[meshParentName].getWorldMatrix());

  // --- RUNTIME hierarchy (identical structure; only the joint's local matrix
  //     differs, exactly as an animation channel would drive it) ---
  const runtimeChainSpec = restChainSpec.map(spec =>
    spec.name === 'joint' ? { ...spec, matrix: jointRuntimeMatrix } : spec
  );
  const runtimeNodes = buildHierarchy(runtimeChainSpec);
  const jointWorldRuntime = new Float32Array(runtimeNodes['joint'].getWorldMatrix());
  const meshParentWorldRuntime = new Float32Array(runtimeNodes[meshParentName].getWorldMatrix());

  // --- IBM_j = inverse(jointWorld_BIND_j) ---
  const IBM = mat4.create();
  mat4.invert(IBM, jointWorldBindMatrix);
  const jointWorldBind = mat4.create();
  mat4.invert(jointWorldBind, IBM); // == jointWorldBindMatrix, recovered via inverse(IBM_j) as the claim specifies

  // --- baked = jointWorld_BIND_j x inverse(jointWorld_REST_j) x nodeWorld_REST ---
  const invJointWorldRest = mat4.create();
  mat4.invert(invJointWorldRest, jointWorldRest);
  const restRelativeToJointRest = mat4.create();
  mat4.multiply(restRelativeToJointRest, invJointWorldRest, meshParentWorldRest);
  const bakeMatrix = mat4.create();
  mat4.multiply(bakeMatrix, jointWorldBind, restRelativeToJointRest);

  const vertexCount = localPositions.length;
  const modelPositions = new Float32Array(vertexCount * 3);
  const modelNormals = localNormals ? new Float32Array(vertexCount * 3) : null;
  for (let i = 0; i < vertexCount; i++) {
    modelPositions.set(transformPoint(bakeMatrix, localPositions[i]), i * 3);
    if (localNormals) {
      modelNormals.set(transformNormalUpper3x3(bakeMatrix, localNormals[i]), i * 3);
    }
  }

  // --- boneMatrix = jointWorld_RUNTIME_j x IBM_j ---
  const boneMatrix = mat4.create();
  mat4.multiply(boneMatrix, jointWorldRuntime, IBM);

  skinAndCompare({
    modelPositions, modelNormals, boneMatrix,
    localPositions, localNormals, meshParentWorldRuntime,
    expectMatch: true, label
  });

  return { bakeMatrix, boneMatrix };
}

/**
 * OLD (buggy) formula, kept only as a regression guard:
 *   baked      = nodeWorld_REST x v_local   (ignores bind pose entirely)
 *   boneMatrix = jointWorld_RUNTIME_j x IBM_j   (IBM_j still from the true bind pose)
 * When REST == BIND this happens to be correct (see the degenerate-case
 * tests below). When REST != BIND it must FAIL -- this function asserts that
 * failure, so this bug can never silently reappear.
 */
function runOldFormulaRegressionCheck({ restChainSpec, jointWorldBindMatrix, jointRuntimeMatrix, localPositions, localNormals, label }) {
  const meshParentName = restChainSpec[restChainSpec.length - 1].name;

  const restNodes = buildHierarchy(restChainSpec);
  const meshParentWorldRest = new Float32Array(restNodes[meshParentName].getWorldMatrix());

  const runtimeChainSpec = restChainSpec.map(spec =>
    spec.name === 'joint' ? { ...spec, matrix: jointRuntimeMatrix } : spec
  );
  const runtimeNodes = buildHierarchy(runtimeChainSpec);
  const jointWorldRuntime = new Float32Array(runtimeNodes['joint'].getWorldMatrix());
  const meshParentWorldRuntime = new Float32Array(runtimeNodes[meshParentName].getWorldMatrix());

  const IBM = mat4.create();
  mat4.invert(IBM, jointWorldBindMatrix);

  // OLD (buggy) bake: assumes REST == BIND, so just bakes the rest-pose world.
  const bakeMatrix = meshParentWorldRest;

  const vertexCount = localPositions.length;
  const modelPositions = new Float32Array(vertexCount * 3);
  const modelNormals = localNormals ? new Float32Array(vertexCount * 3) : null;
  for (let i = 0; i < vertexCount; i++) {
    modelPositions.set(transformPoint(bakeMatrix, localPositions[i]), i * 3);
    if (localNormals) {
      modelNormals.set(transformNormalUpper3x3(bakeMatrix, localNormals[i]), i * 3);
    }
  }

  const boneMatrix = mat4.create();
  mat4.multiply(boneMatrix, jointWorldRuntime, IBM);

  skinAndCompare({
    modelPositions, modelNormals, boneMatrix,
    localPositions, localNormals, meshParentWorldRuntime,
    expectMatch: false, label
  });
}

// ---------------------------------------------------------------------------
// Degenerate-case tests: REST == BIND. The new formula must still pass here
// (it must be a strict generalisation of the old one), and its bake matrix
// must collapse to exactly the old formula's bake matrix.
// ---------------------------------------------------------------------------

test('Degenerate (REST == BIND) Case 1: direct joint parent', () => {
  const bindChainSpec = [
    { name: 'root', matrix: trs([2, -1, 3], [10, 20, 5], [1, 1, 1]), isJoint: false },
    { name: 'joint', matrix: trs([1, 2, 0.5], [30, -15, 60], [1.2, 0.8, 1.1]), isJoint: true }
    // mesh parent === joint (last entry)
  ];
  const jointRuntime = trs([5, -3, 2.5], [45, 90, -20], [0.7, 1.5, 1.0]);
  const jointWorldBindMatrix = computeRestJointWorld(bindChainSpec); // BIND == REST here

  const localPositions = [
    vec3.fromValues(0, 0, 0),
    vec3.fromValues(1, 0, 0),
    vec3.fromValues(0, 2, 0),
    vec3.fromValues(-1.5, 0.75, 3),
    vec3.fromValues(2, -2, -2)
  ];
  const localNormals = [
    vec3.fromValues(0, 1, 0),
    vec3.fromValues(1, 0, 0),
    vec3.fromValues(0, 0, 1),
    vec3.fromValues(0.577, 0.577, 0.577),
    vec3.fromValues(-0.408, 0.816, -0.408)
  ];

  const { bakeMatrix } = runNewFormulaCheck({
    restChainSpec: bindChainSpec, jointWorldBindMatrix, jointRuntimeMatrix: jointRuntime,
    localPositions, localNormals, label: 'degenerate case 1'
  });

  // The new formula's bake must collapse to nodeWorld_REST exactly when REST == BIND.
  const nodeWorldRest = computeRestJointWorld(bindChainSpec); // meshParent === joint here
  for (let k = 0; k < 16; k++) {
    assert(Math.abs(bakeMatrix[k] - nodeWorldRest[k]) <= EPS, `Bake matrix should collapse to nodeWorld_REST when REST == BIND (element ${k})`);
  }
});

test('Degenerate (REST == BIND) Case 2: indirect - non-joint child of joint', () => {
  const bindChainSpec = [
    { name: 'root', matrix: trs([0, 0, 0], [0, 0, 0], [1, 1, 1]), isJoint: false },
    { name: 'joint', matrix: trs([2, 1, -1], [40, 10, -30], [1.1, 0.9, 1.2]), isJoint: true },
    { name: 'meshParent', matrix: trs([0.5, 1.5, -0.5], [15, -25, 5], [0.9, 1.1, 1.0]), isJoint: false }
  ];
  const jointRuntime = trs([-2, 4, 1], [70, -40, 15], [1.3, 0.6, 1.4]);
  const jointWorldBindMatrix = computeRestJointWorld(bindChainSpec);

  const localPositions = [
    vec3.fromValues(0, 0, 0),
    vec3.fromValues(1, 1, 1),
    vec3.fromValues(-2, 0.5, 1.5),
    vec3.fromValues(3, -1, 0)
  ];
  const localNormals = [
    vec3.fromValues(0, 1, 0),
    vec3.fromValues(0.577, 0.577, 0.577),
    vec3.fromValues(1, 0, 0),
    vec3.fromValues(0, 0, 1)
  ];

  runNewFormulaCheck({
    restChainSpec: bindChainSpec, jointWorldBindMatrix, jointRuntimeMatrix: jointRuntime,
    localPositions, localNormals, label: 'degenerate case 2'
  });
});

test('Degenerate (REST == BIND) Case 2b: non-joint GRANDCHILD of joint', () => {
  const bindChainSpec = [
    { name: 'root', matrix: trs([1, -1, 1], [5, 5, 5], [1, 1, 1]), isJoint: false },
    { name: 'joint', matrix: trs([-1, 2, 3], [20, -60, 10], [0.8, 1.3, 1.0]), isJoint: true },
    { name: 'intermediate', matrix: trs([1, 0, -2], [50, 5, -10], [1.05, 0.95, 1.1]), isJoint: false },
    { name: 'meshParent', matrix: trs([-0.5, -0.5, 1], [-15, 30, 0], [1.0, 1.2, 0.85]), isJoint: false }
  ];
  const jointRuntime = trs([3, 3, -3], [-30, 80, 45], [1.6, 0.5, 1.1]);
  const jointWorldBindMatrix = computeRestJointWorld(bindChainSpec);

  const localPositions = [
    vec3.fromValues(0, 0, 0),
    vec3.fromValues(2, -1, 0.5),
    vec3.fromValues(-1, 3, -2),
    vec3.fromValues(0.25, 0.25, 0.25),
    vec3.fromValues(-4, 0, 2)
  ];
  const localNormals = [
    vec3.fromValues(0, 0, 1),
    vec3.fromValues(1, 0, 0),
    vec3.fromValues(0, 1, 0),
    vec3.fromValues(0.707, 0, 0.707),
    vec3.fromValues(-0.577, 0.577, 0.577)
  ];

  runNewFormulaCheck({
    restChainSpec: bindChainSpec, jointWorldBindMatrix, jointRuntimeMatrix: jointRuntime,
    localPositions, localNormals, label: 'degenerate case 2b'
  });
});

test('Degenerate (REST == BIND): runtime pose translated AND rotated AND scaled away from rest', () => {
  const restMatrix = trs([1, 1, 1], [10, 10, 10], [1, 1, 1]);
  const runtimeMatrix = trs([8, -4, 6], [100, 50, -70], [2.2, 0.4, 1.7]);

  // Sanity: confirm the runtime pose is genuinely different in all three components.
  const restT = mat4.getTranslation(vec3.create(), restMatrix);
  const runtimeT = mat4.getTranslation(vec3.create(), runtimeMatrix);
  const restS = mat4.getScaling(vec3.create(), restMatrix);
  const runtimeS = mat4.getScaling(vec3.create(), runtimeMatrix);
  assert(vec3.distance(restT, runtimeT) > 1, 'Runtime translation must differ substantially from rest');
  assert(vec3.distance(restS, runtimeS) > 0.1, 'Runtime scale must differ substantially from rest');
  const restQ = mat4.getRotation(quat.create(), restMatrix);
  const runtimeQ = mat4.getRotation(quat.create(), runtimeMatrix);
  assert(Math.abs(1 - Math.abs(quat.dot(restQ, runtimeQ))) > 0.05, 'Runtime rotation must differ substantially from rest');

  const bindChainSpec = [
    { name: 'root', matrix: trs([0, 0, 0], [0, 0, 0], [1, 1, 1]), isJoint: false },
    { name: 'joint', matrix: restMatrix, isJoint: true },
    { name: 'meshParent', matrix: trs([0.3, -0.2, 0.4], [5, -5, 5], [1.1, 1.1, 0.95]), isJoint: false }
  ];
  const jointWorldBindMatrix = computeRestJointWorld(bindChainSpec);

  const localPositions = [
    vec3.fromValues(0.5, 0.5, 0.5),
    vec3.fromValues(-1, 2, -3)
  ];

  runNewFormulaCheck({
    restChainSpec: bindChainSpec, jointWorldBindMatrix, jointRuntimeMatrix: runtimeMatrix,
    localPositions, localNormals: null, label: 'degenerate pose-stress'
  });
});

test('Degenerate (REST == BIND): negative control - joint stays AT rest pose', () => {
  const bindChainSpec = [
    { name: 'root', matrix: trs([0, 0, 0], [0, 0, 0], [1, 1, 1]), isJoint: false },
    { name: 'joint', matrix: trs([3, -2, 1], [25, 25, 25], [1.1, 0.9, 1.0]), isJoint: true },
    { name: 'meshParent', matrix: trs([0.2, 0.4, -0.6], [8, -8, 8], [1, 1, 1]), isJoint: false }
  ];
  const jointWorldBindMatrix = computeRestJointWorld(bindChainSpec);
  const localPositions = [vec3.fromValues(1, 1, 1), vec3.fromValues(-2, 0.5, 3)];

  // jointRuntimeMatrix === rest matrix
  runNewFormulaCheck({
    restChainSpec: bindChainSpec, jointWorldBindMatrix,
    jointRuntimeMatrix: bindChainSpec[1].matrix,
    localPositions, localNormals: null, label: 'degenerate negative control'
  });
});

test('Degenerate (REST == BIND): multi-vertex stress, single skinMeshInto call', () => {
  const bindChainSpec = [
    { name: 'root', matrix: trs([-3, 2, 1], [15, -15, 15], [1, 1, 1]), isJoint: false },
    { name: 'joint', matrix: trs([4, 4, -4], [-20, 35, 60], [1.3, 0.7, 1.05]), isJoint: true },
    { name: 'meshParent', matrix: trs([-0.8, 0.3, 0.9], [10, 10, -10], [0.95, 1.15, 1.0]), isJoint: false }
  ];
  const jointRuntime = trs([1, -6, 3], [80, -30, 25], [0.6, 1.8, 1.2]);
  const jointWorldBindMatrix = computeRestJointWorld(bindChainSpec);

  const localPositions = [];
  const localNormals = [];
  for (let i = 0; i < 25; i++) {
    localPositions.push(vec3.fromValues(
      Math.sin(i * 0.7) * 5,
      Math.cos(i * 1.3) * 3 - 1,
      Math.sin(i * 0.4 + 1) * 4 + 2
    ));
    const n = vec3.fromValues(Math.sin(i), Math.cos(i * 0.5), Math.sin(i * 0.3 + 2));
    vec3.normalize(n, n);
    localNormals.push(n);
  }

  runNewFormulaCheck({
    restChainSpec: bindChainSpec, jointWorldBindMatrix, jointRuntimeMatrix: jointRuntime,
    localPositions, localNormals, label: 'degenerate multi-vertex'
  });
});

// ---------------------------------------------------------------------------
// REAL-WORLD cases: REST != BIND. This is what cleric.gltf actually looks
// like ("Weapon.R" has a ~79 degree rotation + translation(1.44, 1.81, -0.22)
// residual between rest and bind). The new formula must pass; the OLD
// formula must fail (regression guard).
// ---------------------------------------------------------------------------

// A rest/bind gap modeled on the "Weapon.R" measurement: ~79 degree rotation
// plus a substantial translation offset between the rest-pose world and the
// true bind-pose world of the joint.
const WEAPON_R_LIKE_REST_CHAIN = [
  { name: 'root', matrix: trs([0, 0, 0], [0, 0, 0], [1, 1, 1]), isJoint: false },
  { name: 'joint', matrix: trs([2, 0.5, -1], [0, 0, 0], [1, 1, 1]), isJoint: true }
  // mesh parent === joint (direct case, like a weapon bone with the mesh
  // parented right on it)
];
// True BIND world of the joint: same translation ballpark, but rotated ~79
// degrees further and offset by (1.44, 1.81, -0.22) relative to rest -
// mirrors the measured cleric.gltf residual.
const WEAPON_R_LIKE_BIND_WORLD = trs([2 + 1.44, 0.5 + 1.81, -1 - 0.22], [79, 0, 0], [1, 1, 1]);
const WEAPON_R_LIKE_RUNTIME = trs([2, 0.5, -1], [79, 40, -15], [1, 1, 1]); // animated away from rest

function weaponRLikeSanityCheck() {
  const restWorld = computeRestJointWorld(WEAPON_R_LIKE_REST_CHAIN);
  const restQ = mat4.getRotation(quat.create(), restWorld);
  const bindQ = mat4.getRotation(quat.create(), WEAPON_R_LIKE_BIND_WORLD);
  const angleBetween = 2 * Math.acos(Math.min(1, Math.abs(quat.dot(restQ, bindQ)))) * (180 / Math.PI);
  assert(angleBetween > 30, `REST and BIND joint rotations must differ substantially (got ${angleBetween.toFixed(1)} deg)`);
  const restT = mat4.getTranslation(vec3.create(), restWorld);
  const bindT = mat4.getTranslation(vec3.create(), WEAPON_R_LIKE_BIND_WORLD);
  assert(vec3.distance(restT, bindT) > 1, 'REST and BIND joint translations must differ substantially');
}

test('Sanity: "Weapon.R"-like fixture genuinely has REST != BIND (~79 deg + translation gap)', () => {
  weaponRLikeSanityCheck();
});

test('REST != BIND, direct joint parent: NEW formula passes ("Weapon.R"-like case)', () => {
  const localPositions = [
    vec3.fromValues(0, 0, 0),
    vec3.fromValues(1, 0, 0),
    vec3.fromValues(0, 0.5, 1.5),
    vec3.fromValues(-0.3, 0.2, 0.4)
  ];
  const localNormals = [
    vec3.fromValues(0, 1, 0),
    vec3.fromValues(1, 0, 0),
    vec3.fromValues(0, 0, 1),
    vec3.fromValues(0.577, 0.577, 0.577)
  ];

  runNewFormulaCheck({
    restChainSpec: WEAPON_R_LIKE_REST_CHAIN,
    jointWorldBindMatrix: WEAPON_R_LIKE_BIND_WORLD,
    jointRuntimeMatrix: WEAPON_R_LIKE_RUNTIME,
    localPositions, localNormals,
    label: 'Weapon.R-like, direct parent'
  });
});

test('REST != BIND, indirect non-joint child of joint: NEW formula passes', () => {
  const restChainSpec = [
    { name: 'root', matrix: trs([0, 0, 0], [0, 0, 0], [1, 1, 1]), isJoint: false },
    { name: 'joint', matrix: trs([2, 0.5, -1], [0, 0, 0], [1, 1, 1]), isJoint: true },
    { name: 'meshParent', matrix: trs([0.4, 0.1, -0.2], [10, -5, 0], [1, 1, 1]), isJoint: false }
  ];
  const jointWorldBindMatrix = WEAPON_R_LIKE_BIND_WORLD;
  const jointRuntimeMatrix = WEAPON_R_LIKE_RUNTIME;

  const localPositions = [
    vec3.fromValues(0, 0, 0),
    vec3.fromValues(0.5, -0.5, 1),
    vec3.fromValues(-1, 1, 0)
  ];
  const localNormals = [
    vec3.fromValues(0, 1, 0),
    vec3.fromValues(1, 0, 0),
    vec3.fromValues(0, 0, 1)
  ];

  runNewFormulaCheck({
    restChainSpec, jointWorldBindMatrix, jointRuntimeMatrix,
    localPositions, localNormals, label: 'Weapon.R-like, indirect child'
  });
});

// ---------------------------------------------------------------------------
// REGRESSION GUARD: the OLD formula (baked = nodeWorld_REST, ignoring the
// true bind pose) must FAIL on the same REST != BIND fixture above. If this
// test ever starts passing, the regression case has stopped reproducing the
// bug and needs a bigger rest/bind gap.
// ---------------------------------------------------------------------------

test('REGRESSION GUARD: OLD formula (baked = nodeWorld_REST) FAILS when REST != BIND', () => {
  const localPositions = [
    vec3.fromValues(0, 0, 0),
    vec3.fromValues(1, 0, 0),
    vec3.fromValues(0, 0.5, 1.5),
    vec3.fromValues(-0.3, 0.2, 0.4)
  ];
  const localNormals = [
    vec3.fromValues(0, 1, 0),
    vec3.fromValues(1, 0, 0),
    vec3.fromValues(0, 0, 1),
    vec3.fromValues(0.577, 0.577, 0.577)
  ];

  runOldFormulaRegressionCheck({
    restChainSpec: WEAPON_R_LIKE_REST_CHAIN,
    jointWorldBindMatrix: WEAPON_R_LIKE_BIND_WORLD,
    jointRuntimeMatrix: WEAPON_R_LIKE_RUNTIME,
    localPositions, localNormals,
    label: 'Weapon.R-like, OLD formula regression'
  });
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log('\n=== Test Summary (test-one-bone-skinning.js) ===\n');
console.log(`  Passed: ${testsPassed}`);
console.log(`  Failed: ${testsFailed}`);
console.log('');

if (testsFailed > 0) {
  console.log('TESTS FAILED\n');
  process.exit(1);
} else {
  console.log('ALL TESTS PASSED\n');
}
