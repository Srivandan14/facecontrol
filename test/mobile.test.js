import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { watchGameBackground } from '../src/arcade/background.js';
import { createInputHolds } from '../src/arcade/inputHolds.js';
import { pause } from '../src/arcade/session.js';
import { isModelBundle, loadModelBytes, modelDownloadUrl } from '../src/modelAssets.js';
import { createGraphicsBudget, createTrackingBudget, selfieConstraints } from '../src/performance.js';
import { createRunner, advanceRunner, startRunner } from '../src/runner/engine.js';
import { holdSpaceInput } from '../src/space/controls.js';
import { advanceSpace, createSpace, startSpace } from '../src/space/engine.js';

test('camera requests prefer the front camera and a smaller mobile capture, without asking for audio', () => {
  const phone = selfieConstraints(true);
  const desktop = selfieConstraints(false);
  assert.equal(phone.audio, false);
  assert.deepEqual(phone.video.facingMode, { ideal: 'user' });
  assert(phone.video.width.ideal < desktop.video.width.ideal);
  assert.equal(phone.video.frameRate.max, 30);
});

test('adaptive graphics drop with slow frames and recover after sustained headroom without exceeding the phone cap', () => {
  const budget = createGraphicsBudget({ handheld: true, cores: 8 });
  assert.equal(budget.level, 'medium');
  let now = 0;
  const sample = (interval, count) => { for (let index = 0; index < count; index++) { now += interval; budget.sample(now); } };
  sample(33, 46);
  assert.equal(budget.level, 'low');
  sample(16, 90);
  assert.equal(budget.level, 'low');
  sample(16, 600);
  assert.equal(budget.level, 'medium');
  budget.reset();
  sample(1000, 5);
  assert.equal(budget.level, 'medium');
  assert.equal(createGraphicsBudget({ handheld: true, cores: 4 }).level, 'low');
  assert.equal(createGraphicsBudget().level, 'high');
});

test('tracking lowers processing resolution and inference frequency if frames are slow', () => {
  const fast = createTrackingBudget(true);
  const slow = createTrackingBudget(true);
  let fastCount = 0;
  let slowCount = 0;
  for (let frame = 0; frame < 60; frame++) {
    const time = frame * 1000 / 30;
    if (fast.canSample(time)) { fastCount++; fast.measured(time, 10); }
    if (slow.canSample(time)) { slowCount++; slow.measured(time, 49); }
  }
  assert.equal(fastCount, 60);
  assert(slowCount > 28 && slowCount < fastCount);
  assert.equal(fast.maxEdge, 480);
  assert.equal(slow.maxEdge, 384);
});

test('visibility events freeze gameplay and foregrounding never resumes it automatically', () => {
  const session = createRunner();
  startRunner(session);
  advanceRunner(session, 3.2);
  const activeTime = session.world.seconds;
  const page = Object.assign(new EventTarget(), { hidden: false });
  const browser = new EventTarget();
  const stop = watchGameBackground(page, browser, () => pause(session));
  page.hidden = true;
  page.dispatchEvent(new Event('visibilitychange'));
  advanceRunner(session, 2);
  assert.equal(session.phase, 'paused');
  assert.equal(session.world.seconds, activeTime);
  page.hidden = false;
  page.dispatchEvent(new Event('visibilitychange'));
  assert.equal(session.phase, 'paused');
  assert.equal(startRunner(session), true);
  browser.dispatchEvent(new Event('pagehide'));
  assert.equal(session.phase, 'paused');
  stop();
  startRunner(session);
  browser.dispatchEvent(new Event('pagehide'));
  assert.equal(session.phase, 'countdown');
});

test('SpaceFace steers and fires with distinct touch IDs and clears both on cancellation', () => {
  const session = createSpace();
  startSpace(session);
  advanceSpace(session, 3);
  const holds = createInputHolds((action, pressed) => holdSpaceInput(session, action, pressed));
  const start = session.world.x;
  holds.press('pointer:1', 'left');
  holds.press('pointer:2', 'fire');
  advanceSpace(session, .31);
  assert(session.world.x < start);
  assert.equal(session.world.lasers.length, 2);
  holds.release('pointer:1');
  assert.equal(session.world.manual.left, false);
  assert.equal(session.world.manual.fire, true);
  holds.clear();
  assert.equal(session.world.manual.fire, false);
  advanceSpace(session, .12);
  assert.equal(session.world.lasers.length, 2);
});

function mockBundle() {
  const bytes = new Uint8Array(1_000_003);
  bytes.set([0x50, 0x4b, 3, 4], 2);
  bytes.set([0x50, 0x4b, 5, 6], bytes.length - 22);
  return bytes;
}

test('model validation rejects invalid or truncated downloads', () => {
  const bytes = mockBundle();
  assert(isModelBundle(bytes));
  assert.equal(isModelBundle(bytes.subarray(0, -1)), false);
  assert.equal(isModelBundle(new Uint8Array(bytes.length)), false);
});

test('model loader uses the repository-relative artifact without contacting Google when present', async () => {
  const local = '/facecontrol/models/face_landmarker.task';
  const attempted = [];
  const bytes = await loadModelBytes(local, new AbortController().signal, async (url, options) => {
    attempted.push(url);
    assert.equal(options.credentials, 'omit');
    return new Response(mockBundle());
  });
  assert(isModelBundle(bytes));
  assert.deepEqual(attempted, [local]);
});

test('model loader falls back from an HTML response but never continues after cancellation', async () => {
  const local = '/facecontrol/models/face_landmarker.task';
  const urls = [];
  const controller = new AbortController();
  const bytes = await loadModelBytes(local, controller.signal, async url => {
    urls.push(url);
    return url === local ? new Response('<html>', { headers: { 'content-type': 'text/html' } }) : new Response(mockBundle());
  });
  assert(isModelBundle(bytes));
  assert.deepEqual(urls, [local, modelDownloadUrl]);
  await assert.rejects(loadModelBytes(local, controller.signal, async (url, options) => {
    assert.equal(url, local);
    controller.abort();
    assert(options.signal.aborted);
    throw Error('aborted');
  }), /aborted/);
});

test('PWA manifest uses scoped routes and contains valid-sized icons, including Apple touch art', async () => {
  const publicRoot = new URL('../public/', import.meta.url);
  const manifest = JSON.parse(await readFile(new URL('manifest.webmanifest', publicRoot), 'utf8'));
  const published = 'https://example.github.io/facecontrol/manifest.webmanifest';
  for (const path of [manifest.scope, manifest.start_url, manifest.id]) assert.equal(new URL(path, published).pathname, '/facecontrol/');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.orientation, 'any');
  assert(manifest.icons.some(icon => icon.purpose === 'maskable'));
  for (const { src, sizes } of [...manifest.icons, { src: 'icons/apple-touch-icon.png', sizes: '180x180' }]) {
    assert(new URL(src, published).pathname.startsWith('/facecontrol/icons/'));
    const data = await readFile(new URL(src, publicRoot));
    assert.equal(`${data.readUInt32BE(16)}x${data.readUInt32BE(20)}`, sizes);
  }
});

test('service worker responds only to scoped navigation and provides an offline explanation', async () => {
  const handlers = new Map();
  const scope = 'https://example.github.io/facecontrol/';
  const source = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');
  runInNewContext(source, {
    self: { registration: { scope }, addEventListener: (event, handler) => handlers.set(event, handler) },
    fetch: () => Promise.reject(Error('offline')), Response,
  });
  let result;
  const navigate = (url, mode) => handlers.get('fetch')({ request: { method: 'GET', url, mode }, respondWith: response => { result = response; } });
  navigate(scope + 'models/face_landmarker.task', 'cors');
  navigate('https://example.github.io/another/', 'navigate');
  assert.equal(result, undefined);
  navigate(scope, 'navigate');
  const response = await result;
  assert.equal(response.status, 503);
  assert.match(await response.text(), /FaceControl is offline/);
});
