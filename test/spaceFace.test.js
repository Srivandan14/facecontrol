import assert from 'node:assert/strict';
import { test } from 'node:test';
import { selectMode } from '../src/arcade/session.js';
import { createGestureEngine } from '../src/gestureEngine.js';
import { highScore, readScores, saveScore } from '../src/scores.js';
import { acceptSpaceTracking, holdSpaceInput, spaceInput } from '../src/space/controls.js';
import {
  advanceSpace, advanceSpaceWorld, arena, blastRadius, createFormation, createSpace, createSpaceWorld,
  energyCapacity, fireInterval, fireLaser, scoreFor, shieldTime, startSpace, useBlast,
} from '../src/space/engine.js';

function randomFrom(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function run(mode = 'manual') {
  const session = createSpace(() => .4);
  selectMode(session, mode);
  if (mode === 'camera') acceptSpaceTracking(session, true);
  assert.equal(startSpace(session), true);
  advanceSpace(session, 3);
  session.world.asteroids = [];
  session.world.formations = [];
  session.world.lastFormation.arrival = Infinity;
  return session;
}

function asteroid(x, y = arena.shipY, radius = 24) {
  return { x, arrival: (arena.shipY - y) / 160, radius, speed: 160, shape: .5, removed: false, passed: false };
}

test('horizontal movement is smooth, frame-rate independent and clamped to the arena', () => {
  const slow = run();
  const fast = run();
  for (const session of [slow, fast]) holdSpaceInput(session, 'right', true);
  for (let step = 0; step < 20; step++) advanceSpace(fast, .01);
  advanceSpace(slow, .2);
  assert.ok(fast.world.x > 445 && fast.world.x < 478);
  assert.ok(Math.abs(fast.world.x - slow.world.x) < 1e-8);
  advanceSpace(fast, 2);
  assert.equal(fast.world.x, arena.width - 31);
  holdSpaceInput(fast, 'right', false);
  holdSpaceInput(fast, 'left', true);
  advanceSpace(fast, 3);
  assert.equal(fast.world.x, 31);
});

const neutral = { blink: 0, roll: 3, mouth: 0, smile: 0 };
const profile = { neutral, thresholds: { blink: .4, tiltLeft: 10, tiltRight: 10, mouth: .25, smile: .35 } };

function createFeeder(session) {
  const detector = createGestureEngine();
  let now = 0;
  return (signals, frames) => {
    const accepted = [];
    for (let frame = 0; frame < frames; frame++) {
      const { active, triggered } = detector.update(signals, now, profile);
      accepted.push(acceptSpaceTracking(session, Boolean(signals), triggered, active));
      advanceSpace(session, .033);
      now += 33;
    }
    return accepted.filter(Boolean);
  };
}

test('real gesture-engine outputs can steer and fire simultaneously, then settle at neutral', () => {
  const session = run('camera');
  const feed = createFeeder(session);
  feed(neutral, 11);
  feed({ ...neutral, roll: 27, mouth: .86 }, 20);
  assert.equal(session.world.faceInput.direction, -1);
  assert.equal(session.world.faceInput.fire, true);
  assert.ok(session.world.x < 340);
  assert.ok(session.world.lasers.length >= 2);
  feed(neutral, 13);
  assert.equal(session.world.faceInput.direction, 0);
  assert.equal(session.world.faceInput.fire, false);
  const nearStop = session.world.x;
  advanceSpace(session, .35);
  assert.ok(Math.abs(session.world.x - nearStop) < 1);
  feed({ ...neutral, roll: -24 }, 20);
  assert.equal(session.world.faceInput.direction, 1);
  assert.ok(session.world.x > nearStop);
});

test('firing immediately on press and continuing while held respects the same cooldown', () => {
  const session = run();
  holdSpaceInput(session, 'fire', true);
  holdSpaceInput(session, 'fire', false);
  assert.equal(session.world.lasers.length, 1);
  assert.equal(fireLaser(session.world), false);
  holdSpaceInput(session, 'fire', true);
  advanceSpace(session, fireInterval - .03);
  assert.equal(session.world.lasers.length, 1);
  advanceSpace(session, .06);
  assert.equal(session.world.lasers.length, 2);
  holdSpaceInput(session, 'fire', false);
  advanceSpace(session, .25);
  assert.equal(session.world.lasers.length, 2);
});

test('projectiles hit the closest intersecting asteroid, miss off-axis ones, and charge energy', () => {
  const { world } = run();
  const upper = asteroid(world.x, 190);
  const lower = asteroid(world.x, 270);
  const offAxis = asteroid(world.x + 48, 335);
  world.asteroids = [upper, offAxis, lower];
  fireLaser(world);
  advanceSpaceWorld(world, .27);
  assert.equal(world.destroyed, 1);
  assert.equal(world.energy, 20);
  assert.equal(lower.removed, true);
  assert.equal(upper.removed, false);
  assert.equal(offAxis.removed, false);
  assert.equal(world.lasers.length, 0);
});

test('hitting one group takes one life and the third unshielded hit ends the run', () => {
  const session = run();
  const { world } = session;
  const pushAtShip = () => { world.asteroids.push({ ...asteroid(world.x), arrival: world.seconds }); };
  assert.equal(world.lives, 3);
  pushAtShip();
  pushAtShip();
  advanceSpace(session, .05);
  assert.equal(world.lives, 2);
  for (const remaining of [1, 0]) {
    advanceSpace(session, 1);
    pushAtShip();
    advanceSpace(session, .03);
    assert.equal(world.lives, remaining);
  }
  assert.equal(session.phase, 'over');
});

test('shield absorbs a hit once, health restores one life, and healing caps at three', () => {
  const session = run();
  const { world } = session;
  const collect = type => world.pickups.push({ x: world.x, speed: 160, type, arrival: world.seconds });
  world.lives = 1;
  collect('shield');
  advanceSpace(session, .01);
  assert.ok(shieldTime(world) > 9);
  world.asteroids.push({ ...asteroid(world.x), arrival: world.seconds });
  advanceSpace(session, .01);
  assert.equal(world.lives, 1);
  assert.equal(shieldTime(world), 0);
  collect('health');
  advanceSpace(session, .01);
  assert.equal(world.lives, 2);
  collect('health');
  collect('health');
  advanceSpace(session, .01);
  assert.equal(world.lives, 3);
  assert.equal(world.collected, 4);
  assert.equal(world.energy, 40);
  collect('shield');
  advanceSpace(session, 10.1);
  assert.equal(shieldTime(world), 0);
});

test('a full blast destroys nearby asteroids, spares distant ones and does not refill itself', () => {
  const { world } = run();
  const near = asteroid(world.x + 155, arena.shipY - 100);
  const far = asteroid(world.x, arena.shipY - blastRadius - 60);
  world.asteroids = [near, far];
  world.energy = 99;
  assert.equal(useBlast(world), false);
  world.energy = energyCapacity;
  assert.equal(useBlast(world), true);
  assert.equal(world.destroyed, 1);
  assert.equal(near.removed, true);
  assert.equal(far.removed, false);
  assert.equal(world.energy, 0);
  assert.equal(useBlast(world), false);
});

test('holding a smile through a recharge cannot trigger an automatic second blast', () => {
  const session = run('camera');
  const feed = createFeeder(session);
  const smile = { ...neutral, smile: .91 };
  feed(neutral, 11);
  feed(smile, 16);
  session.world.energy = energyCapacity;
  assert.deepEqual(feed(smile, 22), []);
  assert.equal(session.world.energy, energyCapacity);
  feed(neutral, 13);
  assert.deepEqual(feed(smile, 23), ['blast']);
  assert.equal(session.world.energy, 0);
  session.world.energy = energyCapacity;
  assert.deepEqual(feed(smile, 20), []);
  assert.equal(spaceInput(session, 'blast'), 'blast');
});

test('seeded late-game asteroid waves get denser and keep a reachable safe corridor', () => {
  const random = randomFrom(821);
  let previous = null;
  const speeds = [];
  for (let index = 0; index < 100; index++) {
    const row = createFormation(previous, random);
    const safeX = 126 + row.safe * 144;
    assert.ok(row.asteroids.every(rock => Math.abs(rock.x - safeX) >= 144));
    assert.ok(!row.pickup || row.pickup.x === safeX);
    if (previous) {
      assert.ok(Math.abs(row.safe - previous.safe) <= 1);
      const interval = row.arrival - previous.arrival;
      const hazardousTime = (65 / Math.min(...row.asteroids.map(rock => rock.speed))) + (65 / Math.min(...previous.asteroids.map(rock => rock.speed)));
      assert.ok(interval - hazardousTime > .95);
    }
    if (index === 0) assert.equal(row.asteroids.length, 2);
    if (index >= 30) assert.equal(row.asteroids.length, 4);
    speeds.push(Math.min(...row.asteroids.map(rock => rock.speed)));
    previous = row;
  }
  assert.ok(speeds[99] > speeds[0]);
});

test('the safe corridor is flyable through maximum difficulty without lasers after a reaction delay', () => {
  const world = createSpaceWorld(randomFrom(422));
  let target = world.lastFormation;
  let previousArrival = -1;
  for (let frame = 0; frame < 105 * 60; frame++) {
    if (world.seconds > target.arrival + .48) {
      previousArrival = target.arrival;
      target = world.formations.find(row => row.index > target.index);
      assert.ok(target);
    }
    const remaining = 126 + target.safe * 144 - (world.x + world.velocity * .045);
    const direction = world.seconds > previousArrival + .9 && Math.abs(remaining) >= 8 ? Math.sign(remaining) : 0;
    world.manual.left = direction < 0;
    world.manual.right = direction > 0;
    advanceSpaceWorld(world, 1 / 60);
    assert.equal(world.lives, 3, `formation ${target.index} at ${world.seconds.toFixed(2)}s`);
  }
  assert.ok(target.index > 34);
  assert.ok(world.wave >= 12 && world.passed > 90);
  assert.equal(world.destroyed, 0);
});

test('avoiding an asteroid scores once, surviving a formation charges energy, and score records stay separate', () => {
  const world = createSpaceWorld(() => .4);
  world.x = 126 + world.lastFormation.safe * 144;
  advanceSpaceWorld(world, 4.1);
  assert.equal(world.passed, 2);
  assert.equal(world.energy, 7);
  assert.equal(scoreFor({ seconds: 12.34, destroyed: 3, passed: 2, collected: 1 }), 358);
  const data = new Map();
  const storage = { getItem: key => data.get(key), setItem: (key, value) => data.set(key, value) };
  for (const [gameId, score] of [['runner', 30], ['racer', 60], ['space', 70], ['space', 50]]) saveScore(gameId, score, storage);
  assert.deepEqual(['runner', 'racer', 'space'].map(id => highScore(id, readScores(storage))), [30, 60, 70]);
});

test('tracking loss pauses instantly and only deliberate resume clears the countdown', () => {
  const session = run('camera');
  const { world } = session;
  acceptSpaceTracking(session, true, [], { tiltRight: true, mouth: true });
  holdSpaceInput(session, 'right', true);
  advanceSpace(session, .3);
  acceptSpaceTracking(session, false);
  assert.equal(session.phase, 'paused');
  assert.deepEqual(world.faceInput, { direction: 0, fire: false });
  const before = [world.x, world.seconds, world.lasers.length];
  advanceSpace(session, 5);
  assert.deepEqual([world.x, world.seconds, world.lasers.length], before);
  assert.equal(startSpace(session), false);
  acceptSpaceTracking(session, true, ['smile'], { tiltRight: true, mouth: true });
  assert.equal(session.phase, 'paused');
  assert.equal(startSpace(session), true);
  assert.equal(session.countdown, 3);
  advanceSpace(session, 3.2);
  assert.equal(session.phase, 'running');
  assert.equal(world.x, before[0]);
  assert.equal(world.lasers.length, before[2]);
});
