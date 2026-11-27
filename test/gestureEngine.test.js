import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createGestureEngine, measureCalibrationStep, readFaceSignals } from '../src/gestureEngine.js';

const neutral = { roll: 0, blink: 0, mouth: 0, smile: 0 };

function simulate(engine = createGestureEngine(), sensitivity, profile) {
  let now = 0;
  return (signals, frames = 1) => {
    let result;
    const events = [];
    for (let frame = 0; frame < frames; frame++) {
      result = engine.update(signals, now, profile, sensitivity);
      events.push(...result.triggered);
      now += 33;
    }
    return { active: result.active, events };
  };
}

test('reads real model output, uses bilateral eye closure and measures roll in pixel coordinates', () => {
  const landmarks = [];
  landmarks[33] = { x: .25, y: .25 };
  landmarks[263] = { x: .75, y: .5 };
  const categories = Object.entries({ eyeBlinkLeft: .8, eyeBlinkRight: .2, jawOpen: .7, mouthSmileLeft: .3, mouthSmileRight: .5 })
    .map(([categoryName, score]) => ({ categoryName, score }));
  const result = { faceLandmarks: [landmarks], faceBlendshapes: [{ categories }] };
  assert.deepEqual(readFaceSignals(result, 640, 480), {
    roll: Math.atan2(120, 320) * 180 / Math.PI, blink: .2, mouth: .7, smile: .4,
  });
  assert.equal(readFaceSignals({ faceLandmarks: [] }, 640, 480), null);
  assert.equal(readFaceSignals({ faceLandmarks: [landmarks] }, 640, 480), null);
});

test('a quick bilateral blink pulses once and cooldown blocks immediate repeats', () => {
  const step = simulate();
  const closed = { ...neutral, blink: .9 };
  step(neutral);
  assert.deepEqual(step(closed).events, []);
  const opened = step(neutral);
  assert.deepEqual(opened.events, ['blink']);
  assert.equal(opened.active.blink, true);
  assert.deepEqual(step(closed, 2).events, []);
  assert.deepEqual(step(neutral, 12).events, []);
  const held = step(closed, 18);
  assert.deepEqual(held.events, ['blink']);
  assert.equal(held.active.blink, false);
});

test('smoothing and debounce ignore short movements and emit one event for each held gesture', () => {
  for (const [id, values] of [['tiltLeft', { roll: 20 }], ['tiltRight', { roll: -20 }], ['mouth', { mouth: .75 }], ['smile', { smile: .85 }]]) {
    const step = simulate();
    const moved = { ...neutral, ...values };
    step(neutral);
    assert.deepEqual(step(moved).events, []);
    assert.deepEqual(step(neutral, 20).events, []);
    assert.deepEqual(step(moved, 20), { active: { blink: false, tiltLeft: false, tiltRight: false, mouth: false, smile: false, [id]: true }, events: [id] });
    assert.deepEqual(step(moved, 20).events, []);
    assert.equal(step(neutral, 20).active[id], false);
  }
});

test('losing a face clears gesture state and requires a neutral release on return', () => {
  const step = simulate();
  const smile = { ...neutral, smile: .9 };
  step(neutral);
  assert.equal(step(smile, 15).active.smile, true);
  assert.equal(step(null).active.smile, false);
  assert.deepEqual(step(smile, 15).events, []);
  step(neutral, 15);
  assert.deepEqual(step(smile, 15).events, ['smile']);
});

test('a personalized neutral angle plus sensitivity changes which motions cross the threshold', () => {
  const profile = { neutral: { ...neutral, roll: 5 }, thresholds: { blink: .4, tiltLeft: 10, tiltRight: 10, mouth: .2, smile: .35 } };
  for (const [sensitivity, events] of [[0, []], [100, ['tiltLeft']]]) {
    const step = simulate(createGestureEngine(), sensitivity, profile);
    step(profile.neutral);
    assert.deepEqual(step({ ...neutral, roll: 13 }, 25).events, events);
  }
});

test('calibration rejects too few frames, unstable neutral, and movement in the wrong direction', () => {
  const samples = Array.from({ length: 10 }, () => ({ ...neutral, roll: 3 }));
  assert.ok(measureCalibrationStep('neutral', samples.slice(0, 4)).error);
  assert.ok(measureCalibrationStep('neutral', samples.map((sample, index) => ({ ...sample, roll: index * 2 }))).error);
  const baseline = measureCalibrationStep('neutral', samples).value;
  assert.equal(baseline.roll, 3);
  const left = samples.map(sample => ({ ...sample, roll: 19 }));
  assert.ok(measureCalibrationStep('tiltRight', left, baseline).error);
  assert.equal(measureCalibrationStep('tiltLeft', left, baseline).value, 8);
  const closed = samples.map(sample => ({ ...sample, blink: .8 }));
  assert.ok(measureCalibrationStep('blink', closed, baseline).error);
  assert.ok(measureCalibrationStep('blink', [...samples, ...closed.slice(0, 3)], baseline).value > 0);
});
