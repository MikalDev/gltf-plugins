// tests/test-worker-pool-race.js
// Regression test for the _pendingResponses flush race in TransformWorkerPool.
//
// flush() is fire-and-forget on the tick path (SharedWorkerPool.flushIfPending()
// discards the promise, instance.ts _tick2 does not await). So frame N+1 can
// flush while frame N's worker replies are still in flight. _pendingResponses
// must therefore ACCUMULATE across overlapping flushes, not be overwritten --
// otherwise the counter hits zero early, callbacks fire on a partial result set,
// _pendingResults is cleared, and the still-in-flight results are stranded
// forever (the counter goes negative and `=== 0` never matches again).
//
// Compiled from the actual TransformWorkerPool.ts source via esbuild.
//
// Run: node tests/test-worker-pool-race.js

const esbuild = require('esbuild');
const path = require('path');

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
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
// Browser stubs. The pool touches Blob/URL/navigator/Worker at construction.
// ---------------------------------------------------------------------------

const fakeWorkers = [];
let lastBlobParts = null;

class FakeWorker {
  constructor() {
    this.posted = [];
    this.onmessage = null;
    this.onerror = null;
    fakeWorkers.push(this);
  }
  postMessage(msg) { this.posted.push(msg); }
  terminate() {}
  // Deliver a worker->main reply for this worker.
  reply(data) { this.onmessage({ data }); }
}

// Capture the blob source so a test can assert the assembled worker actually parses.
global.Blob = class Blob {
  constructor(parts) { this.parts = parts; lastBlobParts = parts; }
};
global.URL = { createObjectURL: () => 'blob:fake', revokeObjectURL: () => {} };
global.navigator = { hardwareConcurrency: 4 };
global.Worker = FakeWorker;

// ---------------------------------------------------------------------------
// Compile the real TransformWorkerPool.ts.
// ---------------------------------------------------------------------------

const poolSourcePath = path.join(__dirname, '../c3runtime/gltf/TransformWorkerPool.ts');

const buildResult = esbuild.buildSync({
  entryPoints: [poolSourcePath],
  bundle: true,
  format: 'cjs',
  platform: 'node',
  write: false,
  target: 'es2021'
});

const poolModule = { exports: {} };
new Function('module', 'exports', 'require', buildResult.outputFiles[0].text)(
  poolModule, poolModule.exports, require
);
const { TransformWorkerPool } = poolModule.exports;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VERTS = 3;
const FLOATS = VERTS * 3;

function newPool() {
  fakeWorkers.length = 0;
  return new TransformWorkerPool(2); // 2 workers -> deterministic round-robin
}

// Register one static mesh per worker so a flush hits both workers.
function registerTwoStaticMeshes(pool) {
  pool.registerStaticMeshForLighting(1, new Float32Array(FLOATS), new Float32Array(FLOATS));
  pool.registerStaticMeshForLighting(2, new Float32Array(FLOATS), new Float32Array(FLOATS));
}

// Queue a static transform for both meshes and flush (one frame's dispatch).
function queueAndFlush(pool, onResult) {
  const m = new Float32Array(16);
  pool.queueStaticTransformAndLighting(
    [
      { meshId: 1, instanceMatrix: m, lightConfig: null },
      { meshId: 2, instanceMatrix: m, lightConfig: null }
    ],
    onResult
  );
  pool.flush();
}

// A STATIC_TRANSFORM_AND_LIGHTING_RESULTS reply carrying one mesh.
function staticReply(meshId) {
  return {
    type: 'STATIC_TRANSFORM_AND_LIGHTING_RESULTS',
    meshIds: new Uint32Array([meshId]),
    offsets: new Uint32Array([0, FLOATS]),
    positions: new Float32Array(FLOATS),
    colors: null
  };
}

// ---------------------------------------------------------------------------
// Worker source assembly
//
// WORKER_CODE is the build-generated LightingCore IIFE concatenated with the
// worker body. A concatenation or codegen mistake would only surface at runtime
// inside a Blob worker (where the exception is easy to miss), so assert here that
// the assembled source parses and wires up everything the handlers call.
// ---------------------------------------------------------------------------

test('WORKER_CODE assembles into valid worker source with lighting wired in', () => {
  newPool();
  const source = lastBlobParts.join('');

  const probe = new Function('self', source + `
    return {
      hasHandler: typeof self.onmessage === 'function',
      hasLightingCore: typeof LightingCore !== 'undefined',
      hasLightingFn: typeof LightingCore !== 'undefined' &&
                     typeof LightingCore.calculateLightingInto === 'function',
      hasSkin: typeof skinMeshInto === 'function',
      hasTransform: typeof transformVerticesInto === 'function',
      hasMeshCache: typeof meshCache !== 'undefined',
      hasSkinnedCache: typeof skinnedMeshCache !== 'undefined',
      hasStaticCache: typeof staticLightingCache !== 'undefined'
    };
  `)({ onmessage: null, postMessage() {} });

  assert(probe.hasLightingCore, 'Generated LightingCore IIFE missing from worker source');
  assert(probe.hasLightingFn, 'LightingCore.calculateLightingInto not callable in worker source');
  assert(probe.hasSkin, 'skinMeshInto missing from worker source');
  assert(probe.hasTransform, 'transformVerticesInto missing from worker source');
  assert(probe.hasMeshCache, 'meshCache missing from worker source');
  assert(probe.hasSkinnedCache, 'skinnedMeshCache missing from worker source');
  assert(probe.hasStaticCache, 'staticLightingCache missing from worker source');
  assert(probe.hasHandler, 'worker did not install self.onmessage');
});

test('worker source no longer carries a duplicate lighting implementation', () => {
  newPool();
  const source = lastBlobParts.join('');
  // The old hand-mirrored copy declared `function calculateLighting(`. The shared
  // core is `calculateLightingInto`, reached via the LightingCore namespace.
  assert(
    !/function\s+calculateLighting\s*\(/.test(source),
    'Found a re-declared calculateLighting() in the worker — the mirrored copy is back'
  );
});

// ---------------------------------------------------------------------------
// Flush race
// ---------------------------------------------------------------------------

test('baseline: a single flush delivers every mesh callback', () => {
  const pool = newPool();
  registerTwoStaticMeshes(pool);

  const calls = [];
  queueAndFlush(pool, (meshId) => calls.push(meshId));

  fakeWorkers[0].reply(staticReply(1));
  fakeWorkers[1].reply(staticReply(2));

  assert(calls.length === 2, `Expected 2 callbacks, got ${calls.length}`);
});

test('overlapping flushes: no results are dropped when frame N+1 flushes before frame N replies', () => {
  const pool = newPool();
  registerTwoStaticMeshes(pool);

  const calls = [];

  // Frame N dispatch -- replies deliberately NOT delivered yet.
  queueAndFlush(pool, (meshId) => calls.push(meshId));
  // Frame N+1 dispatch, while frame N is still in flight.
  queueAndFlush(pool, (meshId) => calls.push(meshId));

  // Now all four replies land (two per worker: frame N then frame N+1).
  fakeWorkers[0].reply(staticReply(1));
  fakeWorkers[1].reply(staticReply(2));
  fakeWorkers[0].reply(staticReply(1));
  fakeWorkers[1].reply(staticReply(2));

  // Every dispatched mesh-result must reach its callback. With the counter
  // overwritten instead of accumulated, frame N+1's two results are stranded.
  assert(calls.length === 4, `Expected 4 callbacks across two frames, got ${calls.length}`);
});

test('overlapping flushes: _pendingResponses never goes negative', () => {
  const pool = newPool();
  registerTwoStaticMeshes(pool);

  queueAndFlush(pool, () => {});
  queueAndFlush(pool, () => {});

  fakeWorkers[0].reply(staticReply(1));
  fakeWorkers[1].reply(staticReply(2));
  fakeWorkers[0].reply(staticReply(1));
  fakeWorkers[1].reply(staticReply(2));

  // A negative counter means `=== 0` can never match again, permanently
  // wedging every future flush's callbacks.
  assert(pool._pendingResponses >= 0, `_pendingResponses went negative: ${pool._pendingResponses}`);
  assert(pool._pendingResponses === 0, `Expected counter to settle at 0, got ${pool._pendingResponses}`);
});

test('overlapping flushes: pool still works on the NEXT frame (not permanently wedged)', () => {
  const pool = newPool();
  registerTwoStaticMeshes(pool);

  // Two overlapping frames.
  queueAndFlush(pool, () => {});
  queueAndFlush(pool, () => {});
  fakeWorkers[0].reply(staticReply(1));
  fakeWorkers[1].reply(staticReply(2));
  fakeWorkers[0].reply(staticReply(1));
  fakeWorkers[1].reply(staticReply(2));

  // A third, non-overlapping frame must still deliver.
  const calls = [];
  queueAndFlush(pool, (meshId) => calls.push(meshId));
  fakeWorkers[0].reply(staticReply(1));
  fakeWorkers[1].reply(staticReply(2));

  assert(calls.length === 2, `Pool wedged after an overlapping flush: expected 2 callbacks, got ${calls.length}`);
});

test('flush() with no pending work does not disturb an in-flight count', () => {
  const pool = newPool();
  registerTwoStaticMeshes(pool);

  const calls = [];
  queueAndFlush(pool, (meshId) => calls.push(meshId));

  // An empty flush (nothing queued) must be a no-op, not a counter reset.
  pool.flush();

  fakeWorkers[0].reply(staticReply(1));
  fakeWorkers[1].reply(staticReply(2));

  assert(calls.length === 2, `Expected 2 callbacks after an empty interleaved flush, got ${calls.length}`);
  assert(pool._pendingResponses === 0, `Expected counter to settle at 0, got ${pool._pendingResponses}`);
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log('\n=== Test Summary (test-worker-pool-race.js) ===\n');
console.log(`  Passed: ${testsPassed}`);
console.log(`  Failed: ${testsFailed}`);
console.log('');

if (testsFailed > 0) {
  console.log('TESTS FAILED\n');
  process.exit(1);
} else {
  console.log('ALL TESTS PASSED\n');
}
