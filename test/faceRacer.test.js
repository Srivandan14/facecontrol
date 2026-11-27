import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pause, selectMode } from '../src/arcade/session.js';
import { createGestureEngine, readFaceSignals } from '../src/gestureEngine.js';
import {
  acceptRaceTracking, advanceRace, advanceRaceWorld, createRace, createRaceWorld, createWave,
  laneDuration, laneX, moveLane, roadSpeed, scoreFor, shieldDuration, shieldTime, startRace, steer, trafficCollision,
} from '../src/racer/engine.js';

function randomFrom(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function emptyRoad() {
  const world = createRaceWorld(() => .5);
  world.traffic = [];
  world.pickups = [];
  world.lastWave.arrival = 20000;
  return world;
}

function traffic(lane, arrival = 0) {
  return { lane, arrival, pace: 1, width: 50, height: 76, spent: false, passed: false };
}

function pickup(lane, type, arrival = 0) {
  return { lane, type, arrival, pace: 1, spent: false };
}

test('lane changes ease over time, clamp at the three lanes, and honor a quick reversal', () => {
  const world = emptyRoad();
  assert.equal(world.x, laneX(1));
  assert.equal(moveLane(world, -1), true);
  assert.equal(world.x, laneX(1));
  advanceRaceWorld(world, laneDuration / 3);
  assert.ok(world.x > laneX(.5) && world.x < laneX(1));
  const before = world.x;
  assert.equal(moveLane(world, -1), false);
  assert.equal(moveLane(world, 1), true);
  assert.equal(world.x, before);
  advanceRaceWorld(world, laneDuration);
  assert.equal(world.x, laneX(1));
  assert.equal(moveLane(world, 1), true);
  advanceRaceWorld(world, laneDuration + .01);
  assert.equal(world.x, laneX(2));
  assert.equal(moveLane(world, 1), false);
});

test('lane movement and road travel match across different frame rates', () => {
  const fast = emptyRoad();
  const slow = emptyRoad();
  moveLane(fast, 1);
  moveLane(slow, 1);
  for (let frame = 0; frame < 12; frame++) advanceRaceWorld(fast, .01);
  for (let frame = 0; frame < 3; frame++) advanceRaceWorld(slow, .04);
  assert.ok(Math.abs(fast.distance - slow.distance) < 1e-8);
  assert.ok(Math.abs(fast.x - slow.x) < 1e-8);
});

const neutral = { roll: 3, blink: 0, mouth: 0, smile: 0 };
const profile = { neutral, thresholds: { blink: .4, tiltLeft: 10, tiltRight: 10, mouth: .25, smile: .35 } };

function tiltFrames(race, startingLane, sensitivity) {
  race.world.lane = startingLane;
  race.world.x = laneX(startingLane);
  const engine = createGestureEngine({ neutralTiltReset: true });
  let now = 0;
  return (signals, count) => {
    const gestures = [];
    let changes = 0;
    for (let frame = 0; frame < count; frame++) {
      const { triggered } = engine.update(signals, now, profile, sensitivity);
      gestures.push(...triggered);
      if (acceptRaceTracking(race, Boolean(signals), triggered)) changes++;
      now += 33;
    }
    return { gestures, changes };
  };
}

function cameraRace() {
  const race = createRace();
  selectMode(race, 'camera');
  acceptRaceTracking(race, true);
  startRace(race);
  advanceRace(race, 3);
  return race;
}

function cameraSignal(physicalDirection) {
  const landmarks = [];
  landmarks[33] = { x: .3, y: .5 - physicalDirection * .1 };
  landmarks[263] = { x: .7, y: .5 + physicalDirection * .1 };
  const categories = ['eyeBlinkLeft', 'eyeBlinkRight', 'jawOpen', 'mouthSmileLeft', 'mouthSmileRight'].map(categoryName => ({ categoryName, score: 0 }));
  return readFaceSignals({ faceLandmarks: [landmarks], faceBlendshapes: [{ categories }] }, 640, 480);
}

test('the physically lowered left eye moves the car left in the mirrored view, and right moves right', () => {
  for (const { sign, lane, gesture } of [{ sign: 1, lane: 0, gesture: 'tiltLeft' }, { sign: -1, lane: 2, gesture: 'tiltRight' }]) {
    const race = cameraRace();
    const feed = tiltFrames(race, 1);
    feed(neutral, 10);
    assert.deepEqual(feed(cameraSignal(sign), 20), { gestures: [gesture], changes: 1 });
    assert.equal(race.world.lane, lane);
  }
});

test('holding, easing partway upright, or crossing straight to the opposite tilt does not rearm steering', () => {
  const race = cameraRace();
  const feed = tiltFrames(race, 2);
  const left = { ...neutral, roll: 26 };
  assert.equal(feed(left, 12).changes, 0);
  feed(neutral, 12);
  assert.equal(feed(left, 15).changes, 1);
  assert.equal(feed(left, 35).changes, 0);
  feed({ ...neutral, roll: 9 }, 18);
  assert.equal(feed(left, 14).changes, 0);
  assert.equal(feed({ ...neutral, roll: -25 }, 18).changes, 0);
  assert.equal(feed(left, 18).changes, 0);
  feed(neutral, 13);
  assert.equal(feed(left, 20).changes, 1);
  assert.equal(race.world.lane, 0);
});

test('higher tilt sensitivity detects a smaller change from the calibrated angle', () => {
  for (const [sensitivity, expected] of [[0, 0], [100, 1]]) {
    const feed = tiltFrames(cameraRace(), 1, sensitivity);
    feed(neutral, 11);
    assert.equal(feed({ ...neutral, roll: 11 }, 20).changes, expected);
  }
});

test('collision depends on the current animated car position and traffic must fully pass to count', () => {
  const world = emptyRoad();
  const car = traffic(0);
  assert.equal(trafficCollision(world, car), false);
  world.x = laneX(0) + 25;
  assert.equal(trafficCollision(world, car), true);
  world.x = laneX(1);
  world.traffic = [car];
  advanceRaceWorld(world, .1);
  assert.equal(world.overtakes, 0);
  advanceRaceWorld(world, .4);
  assert.equal(world.overtakes, 1);
  advanceRaceWorld(world, .4);
  assert.equal(world.overtakes, 1);
});

test('coins award points once and a shield pickup expires after nine seconds of play', () => {
  const world = emptyRoad();
  world.pickups = [pickup(0, 'coin'), pickup(1, 'coin'), pickup(1, 'shield', 62)];
  advanceRaceWorld(world, .5);
  assert.equal(world.coins, 1);
  assert.ok(shieldTime(world) > shieldDuration - .5);
  advanceRaceWorld(world, shieldDuration);
  assert.equal(shieldTime(world), 0);
  assert.equal(world.coins, 1);
  world.traffic.push(traffic(1, world.distance));
  advanceRaceWorld(world, .02);
  assert.equal(world.collided, true);
});

test('a shield absorbs one collision and the next unshielded collision ends the run', () => {
  const world = emptyRoad();
  world.pickups = [pickup(1, 'shield')];
  world.traffic = [traffic(1, 130), traffic(1, 360)];
  advanceRaceWorld(world, .5);
  assert.equal(world.collided, false);
  assert.equal(world.shieldBlocks, 1);
  assert.equal(shieldTime(world), 0);
  assert.equal(world.overtakes, 0);
  advanceRaceWorld(world, 1);
  assert.equal(world.collided, true);
  assert.equal(world.shieldBlocks, 1);
});

test('score adds survival time, overtakes and coins', () => {
  assert.equal(scoreFor({ seconds: 12.04, overtakes: 3, coins: 4 }), 120 + 3 * 35 + 4 * 20);
});

test('traffic and pickups vary while each wave keeps a lane open and the reaction gap stays generous', () => {
  const random = randomFrom(42);
  const aggregate = [0, 90].map(seconds => {
    let previous = null;
    const paces = new Set();
    const finishes = new Set();
    let blockers = 0;
    let shields = 0;
    let averageGap = 0;
    for (let index = 0; index < 100; index++) {
      const wave = createWave(previous, seconds, random);
      if (previous) {
        const gap = wave.arrival - previous.arrival;
        averageGap += gap;
        assert.ok((gap - 220) / roadSpeed(90) >= 2 * laneDuration + .89);
      }
      assert.equal(new Set(wave.traffic.map(car => car.lane)).size, wave.traffic.length);
      assert.equal(wave.traffic.some(car => car.lane === wave.safeLane), false);
      assert.ok(wave.pickups.every(item => item.lane === wave.safeLane));
      for (const car of wave.traffic) { paces.add(car.pace); finishes.add(car.finish); }
      blockers += wave.traffic.length;
      shields += wave.pickups.filter(item => item.type === 'shield').length;
      previous = wave;
    }
    assert.equal(finishes.size, 3);
    assert.ok(paces.size > 80 && shields > 10);
    return { blockers, averageGap };
  });
  assert.ok(roadSpeed(90) > roadSpeed(0));
  assert.ok(aggregate[1].blockers > aggregate[0].blockers);
  assert.ok(aggregate[1].averageGap < aggregate[0].averageGap);
});

test('a player can reach the open lane with two separate shifts after a reaction delay at max speed', () => {
  for (const seed of [17, 42, 725, 961]) {
    const world = createRaceWorld(randomFrom(seed));
    world.seconds = 90;
    const waves = [world.lastWave];
    let pending = 0;
    let previousArrival = -110;
    let lastSteerAt = -Infinity;
    for (let frame = 0; frame < 60 * 60; frame++) {
      const next = waves[pending];
      if (next && world.distance > next.arrival + 110) {
        previousArrival = next.arrival;
        pending++;
      } else if (next && world.distance > previousArrival + 110 + roadSpeed(world.seconds) * .50 && world.seconds - lastSteerAt > .46) {
        if (moveLane(world, Math.sign(next.safeLane - world.lane))) lastSteerAt = world.seconds;
      }
      advanceRaceWorld(world, 1 / 60);
      if (waves.at(-1) !== world.lastWave) waves.push(world.lastWave);
      assert.equal(world.collided, false, `seed ${seed}, wave ${pending}`);
    }
    assert.equal(world.shieldBlocks, 0);
    assert.ok(world.overtakes > 35 && world.coins > 60);
  }
});

test('tracking loss freezes a run and the shield timer until a deliberate resume', () => {
  const race = cameraRace();
  race.world.shieldUntil = 6;
  advanceRace(race, .5);
  assert.equal(acceptRaceTracking(race, false, ['tiltLeft']), false);
  assert.equal(race.phase, 'paused');
  assert.equal(race.reason, 'face');
  assert.equal(startRace(race), false);
  const remaining = shieldTime(race.world);
  advanceRace(race, 10);
  assert.equal(shieldTime(race.world), remaining);
  assert.equal(acceptRaceTracking(race, true, ['tiltLeft']), false);
  assert.equal(race.phase, 'paused');
  assert.equal(startRace(race), true);
  advanceRace(race, 2);
  assert.equal(steer(race, 1), false);
  advanceRace(race, 1);
  assert.equal(steer(race, 1), true);
  assert.equal(pause(race), true);
  assert.equal(startRace(race, true), true);
  assert.equal(race.world.lane, 1);
  assert.equal(shieldTime(race.world), 0);
});
