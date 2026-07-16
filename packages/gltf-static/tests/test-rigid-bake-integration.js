// tests/test-rigid-bake-integration.js
//
// Ties the PRODUCTION bake to the proven formula.
//
// test-one-bone-skinning.js proves the maths of the 1-bone conversion, but it
// re-implements the bake formula inside the test. That is exactly how the original
// bug shipped: the proof passed while GltfModel baked the wrong thing, because
// nothing checked that the production code implemented the proven formula.
//
// So this test extracts the REAL GltfModel._computeRigidSkinBakeMatrix and asserts
// the invariant it must satisfy:
//
//     boneMatrix(rest) x bake  ==  nodeWorld_rest
//
// i.e. with the skeleton at its rest pose, a converted rigid mesh must land exactly
// where the scene graph says it is. Because skinning applies `jointWorld x IBM`, and
// a glTF's REST pose is not its BIND pose, baking nodeWorld_rest fails this whenever
// the two poses differ (in cleric.gltf, "Weapon.R" differs by ~79 degrees).
//
// Run: node tests/test-rigid-bake-integration.js

const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');
const { mat4, quat, vec3 } = require('gl-matrix');

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
// Extract the REAL _computeRigidSkinBakeMatrix from GltfModel.ts
// ---------------------------------------------------------------------------

const modelSource = fs.readFileSync(
  path.join(__dirname, '../c3runtime/gltf/GltfModel.ts'), 'utf8'
);

function extractMethodBody(source, signatureRe) {
  const m = source.match(signatureRe);
  if (!m) throw new Error(`Could not find method matching ${signatureRe}`);
  const open = source.indexOf('{', m.index + m[0].length - 1);
  let depth = 0, i = open;
  for (; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') { depth--; if (depth === 0) break; }
  }
  return source.slice(open + 1, i);
}

// The body is TypeScript-flavoured only via `as unknown as mat4` casts; strip those
// so it can be evaluated directly. Everything else is plain JS.
const rawBody = extractMethodBody(
  modelSource,
  /private _computeRigidSkinBakeMatrix\(\s*node: GltfNode,\s*jointNode: GltfNode,\s*jointIndex: number,\s*skin: CachedSkinData\s*\): Float32Array \{/
);
const jsBody = rawBody.replace(/ as unknown as mat4/g, '').replace(/ as mat4/g, '');

// `mat4` is a module import in the real file; inject it here.
const computeRigidSkinBakeMatrix = new Function(
  'mat4', 'node', 'jointNode', 'jointIndex', 'skin', jsBody
).bind(null, mat4);

// ---------------------------------------------------------------------------
// Real GltfNode
// ---------------------------------------------------------------------------

const nodeBuild = esbuild.buildSync({
  entryPoints: [path.join(__dirname, '../c3runtime/gltf/GltfNode.ts')],
  bundle: true, format: 'cjs', platform: 'node', write: false, target: 'es2021'
});
const nodeModule = { exports: {} };
new Function('module', 'exports', 'require', nodeBuild.outputFiles[0].text)(
  nodeModule, nodeModule.exports, require
);
const { GltfNode } = nodeModule.exports;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function trs(t, degrees, s) {
  const q = quat.create();
  quat.fromEuler(q, degrees[0], degrees[1], degrees[2]);
  const m = mat4.create();
  mat4.fromRotationTranslationScale(m, q, t, s);
  return new Float32Array(m);
}

function buildChain(specs) {
  const nodes = {};
  let parent = null;
  for (const s of specs) {
    const n = new GltfNode(s.name, s.matrix);
    if (parent) parent.addChild(n);
    nodes[s.name] = n;
    parent = n;
  }
  return nodes;
}

function assertMatClose(actual, expected, msg) {
  for (let i = 0; i < 16; i++) {
    if (Math.abs(actual[i] - expected[i]) > 1e-4) {
      throw new Error(
        `${msg}\n      actual:   [${Array.from(actual).map(v => v.toFixed(4)).join(', ')}]\n` +
        `      expected: [${Array.from(expected).map(v => v.toFixed(4)).join(', ')}]`
      );
    }
  }
}

// Build a skin whose IBM for `jointIndex` is inverse(jointWorldBind), where the BIND
// pose is supplied independently of the rest-pose node tree.
function makeSkin(jointWorldBind, jointIndex, jointCount) {
  const ibms = new Float32Array(jointCount * 16);
  for (let k = 0; k < jointCount; k++) mat4.identity(ibms.subarray(k * 16, k * 16 + 16));
  const ibm = mat4.create();
  mat4.invert(ibm, jointWorldBind);
  ibms.set(ibm, jointIndex * 16);
  return { joints: new Array(jointCount).fill(null), inverseBindMatrices: ibms };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

// REST pose: what the glTF node TRS encode.
const REST_SPECS = [
  { name: 'Armature', matrix: trs([0, 0, 0], [0, 0, 0], [1, 1, 1]) },
  { name: 'Joint', matrix: trs([1, 2, -1], [10, 5, -15], [1, 1, 1]) },
  { name: 'MeshNode', matrix: trs([0.5, 1, 0.25], [20, -10, 5], [1, 1, 1]) }
];
const JOINT_INDEX = 3;
const JOINT_COUNT = 8;

test('production bake satisfies boneMatrix(rest) x bake == nodeWorld_rest (REST == BIND)', () => {
  const nodes = buildChain(REST_SPECS);
  const jointWorldRest = new Float32Array(nodes['Joint'].getWorldMatrix());
  // Degenerate: bind IS rest.
  const skin = makeSkin(jointWorldRest, JOINT_INDEX, JOINT_COUNT);

  const bake = computeRigidSkinBakeMatrix(nodes['MeshNode'], nodes['Joint'], JOINT_INDEX, skin);

  const ibm = skin.inverseBindMatrices.subarray(JOINT_INDEX * 16, JOINT_INDEX * 16 + 16);
  const boneRest = mat4.create();
  mat4.multiply(boneRest, jointWorldRest, ibm);
  const got = mat4.create();
  mat4.multiply(got, boneRest, bake);

  assertMatClose(got, nodes['MeshNode'].getWorldMatrix(),
    'With rest == bind the mesh must land at its rest-pose world');
});

test('production bake satisfies boneMatrix(rest) x bake == nodeWorld_rest (REST != BIND, ~79deg)', () => {
  const nodes = buildChain(REST_SPECS);
  const jointWorldRest = new Float32Array(nodes['Joint'].getWorldMatrix());

  // BIND pose is authored independently and differs sharply from rest — this mirrors
  // the real cleric.gltf, where "Weapon.R" rest and bind differ by ~79 degrees.
  const jointWorldBind = trs([2.4, 0.2, -1.4], [79, 12, -33], [1, 1, 1]);
  const skin = makeSkin(jointWorldBind, JOINT_INDEX, JOINT_COUNT);

  const bake = computeRigidSkinBakeMatrix(nodes['MeshNode'], nodes['Joint'], JOINT_INDEX, skin);

  const ibm = skin.inverseBindMatrices.subarray(JOINT_INDEX * 16, JOINT_INDEX * 16 + 16);
  const boneRest = mat4.create();
  mat4.multiply(boneRest, jointWorldRest, ibm);
  const got = mat4.create();
  mat4.multiply(got, boneRest, bake);

  assertMatClose(got, nodes['MeshNode'].getWorldMatrix(),
    'With rest != bind the mesh must STILL land at its rest-pose world.\n' +
    '      If this fails, GltfModel._computeRigidSkinBakeMatrix is baking rest-pose\n' +
    '      world instead of joint-bind space — the original displacement bug.');
});

test('production bake is NOT simply nodeWorld_rest when rest != bind', () => {
  const nodes = buildChain(REST_SPECS);
  const jointWorldBind = trs([2.4, 0.2, -1.4], [79, 12, -33], [1, 1, 1]);
  const skin = makeSkin(jointWorldBind, JOINT_INDEX, JOINT_COUNT);

  const bake = computeRigidSkinBakeMatrix(nodes['MeshNode'], nodes['Joint'], JOINT_INDEX, skin);
  const nodeWorldRest = nodes['MeshNode'].getWorldMatrix();

  let differs = false;
  for (let i = 0; i < 16; i++) if (Math.abs(bake[i] - nodeWorldRest[i]) > 1e-3) differs = true;

  if (!differs) {
    throw new Error(
      'bake matrix equals nodeWorld_rest even though rest != bind — the production\n' +
      '      code has regressed to the old (broken) formula.'
    );
  }
});

test('production bake collapses exactly to nodeWorld_rest when rest == bind', () => {
  const nodes = buildChain(REST_SPECS);
  const jointWorldRest = new Float32Array(nodes['Joint'].getWorldMatrix());
  const skin = makeSkin(jointWorldRest, JOINT_INDEX, JOINT_COUNT);

  const bake = computeRigidSkinBakeMatrix(nodes['MeshNode'], nodes['Joint'], JOINT_INDEX, skin);

  assertMatClose(bake, nodes['MeshNode'].getWorldMatrix(),
    'When rest == bind the new bake must reduce to the plain static bake — it is a\n' +
    '      generalisation of it, not a different rule');
});

// ---------------------------------------------------------------------------

console.log('\n=== Test Summary (test-rigid-bake-integration.js) ===\n');
console.log(`  Passed: ${testsPassed}`);
console.log(`  Failed: ${testsFailed}`);
console.log('');

if (testsFailed > 0) {
  console.log('TESTS FAILED\n');
  process.exit(1);
} else {
  console.log('ALL TESTS PASSED\n');
}
