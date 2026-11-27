import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createGestureEngine } from '../src/gestureEngine.js';
import { highScore, readScores, saveScore } from '../src/scores.js';
import {
  acceptTrackingFrame, advanceRunner, advanceWorld, arena, createObstacle, createRunner,
  createWorld, hitsObstacle, jump, pauseRunner, robot, runnerJump, runSpeed, scoreFor, selectRunnerMode, startRunner,
} from '../src/runner/engine.js';

const neutral = { blink: 0, mouth: 0, smile: 0, roll: 2 };
const profile = { neutral, thresholds: { blink: .35, tiltLeft: 10, tiltRight: 10, mouth: .24, smile: .36 } };

function seededRandom(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

test('a jump rises, lands at ground level and refuses every mid-air jump', () => {
  const rapid = createWorld();
  const slow = createWorld();
  assert.equal(jump(rapid), true);
  assert.equal(jump(slow), true);
  assert.equal(jump(rapid), false);
  for (let frame = 0; frame < 20; frame++) advanceWorld(rapid, .01);
  advanceWorld(slow, .2);
  assert.ok(rapid.y > 90);
  assert.ok(Math.abs(rapid.y - slow.y) < 1e-8);
  assert.equal(jump(rapid), false);
  advanceWorld(rapid, .7);
  assert.equal(rapid.y, 0);
  assert.equal(rapid.velocity, 0);
  assert.equal(rapid.grounded, true);
  assert.equal(jump(rapid), true);
});

test('collision detects horizontal overlap and height and freezes a crashed run', () => {
  const world = createWorld();
  const obstacle = { x: robot.x + 20, width: 48, height: 54, cleared: false };
  assert.equal(hitsObstacle(world, obstacle), true);
  assert.equal(hitsObstacle(world, { ...obstacle, x: robot.x + robot.width + 1 }), false);
  assert.equal(hitsObstacle({ ...world, y: 70 }, obstacle), false);
  obstacle.x = robot.x + robot.width + 13;
  world.obstacles = [obstacle];
  advanceWorld(world, .15);
  assert.equal(world.collided, true);
  assert.ok(world.seconds < .15);
  const score = scoreFor(world);
  advanceWorld(world, 2);
  assert.equal(scoreFor(world), score);
});

test('survival awards ten points per second and each fully cleared barrier is counted once', () => {
  const world = createWorld(() => 0);
  world.obstacles[0].x = robot.x + 44;
  assert.equal(scoreFor(world), 0);
  world.y = 100;
  world.grounded = false;
  advanceWorld(world, .3);
  assert.equal(world.cleared, 1);
  assert.equal(scoreFor(world), 53);
  advanceWorld(world, .3);
  assert.equal(world.cleared, 1);
  assert.equal(scoreFor(world), 56);
});

test('generated barriers vary, start outside the arena, and stay fair at maximum speed', () => {
  const random = seededRandom(15);
  for (const seconds of [0, 20, 45, 85]) {
    let last = createObstacle(null, seconds, random);
    assert.ok(last.x > arena.width);
    const sizes = new Set();
    for (let index = 0; index < 50; index++) {
      const current = createObstacle(last, seconds, random);
      const airTimePlusReaction = .76 + .34;
      assert.ok(current.x - last.x - last.width >= runSpeed(seconds) * airTimePlusReaction);
      assert.ok(current.height < 76 && current.width < 65);
      sizes.add(current.height);
      last = current;
    }
    assert.ok(sizes.size > 10);
  }
  assert.ok(runSpeed(20) > runSpeed(0));
  assert.equal(runSpeed(100), runSpeed(200));
});

test('a timed jump can clear successive randomized barriers through max difficulty', () => {
  const world = createWorld(seededRandom(982));
  for (let frame = 0; frame < 85 * 120; frame++) {
    const next = world.obstacles.find(obstacle => !obstacle.cleared);
    const timeToReach = (next.x - robot.x - robot.width) / runSpeed(world.seconds);
    if (timeToReach >= 0 && timeToReach <= .29) jump(world);
    advanceWorld(world, 1 / 120);
    assert.equal(world.collided, false, `collision at ${world.seconds.toFixed(3)} seconds`);
  }
  assert.ok(world.cleared > 40);
  assert.ok(scoreFor(world) > 2800);
});

test('countdown, pause, resume, and restart preserve or reset the run as intended', () => {
  const runner = createRunner();
  assert.equal(startRunner(runner), true);
  advanceRunner(runner, 2.9);
  assert.equal(runner.phase, 'countdown');
  assert.equal(runnerJump(runner), false);
  advanceRunner(runner, .2);
  assert.equal(runner.phase, 'running');
  const score = scoreFor(runner.world);
  assert.equal(pauseRunner(runner), true);
  advanceRunner(runner, .5);
  assert.equal(scoreFor(runner.world), score);
  assert.equal(startRunner(runner), true);
  assert.equal(runner.countdown, 3);
  assert.equal(scoreFor(runner.world), score);
  assert.equal(startRunner(runner, true), true);
  assert.equal(scoreFor(runner.world), 0);
});

test('calibrated blink events reject quick blinks and jump once even while the eyes stay closed', () => {
  const runner = createRunner();
  const tracking = createGestureEngine({ blinkHold: 115 });
  let timestamp = 0;
  function feed(blink, frames) {
    let jumps = 0;
    for (let frame = 0; frame < frames; frame++) {
      const { triggered } = tracking.update({ ...neutral, blink }, timestamp, profile);
      jumps += Number(acceptTrackingFrame(runner, true, triggered));
      timestamp += 33;
      advanceRunner(runner, .033);
    }
    return jumps;
  }
  selectRunnerMode(runner, 'camera');
  assert.equal(startRunner(runner), false);
  feed(0, 1);
  assert.equal(startRunner(runner), true);
  assert.equal(feed(.95, 6), 0);
  feed(0, 86);
  assert.equal(runner.phase, 'running');
  assert.equal(feed(.95, 2), 0);
  assert.equal(feed(0, 4), 0);
  assert.equal(feed(.95, 35), 1);
  assert.equal(runner.world.grounded, true);
  assert.equal(feed(0, 4), 0);
  assert.equal(feed(.95, 7), 1);
  assert.equal(runnerJump(runner), false);
});

test('lost tracking pauses immediately, reacquiring a face cannot restart, and manual mode works without it', () => {
  const runner = createRunner();
  selectRunnerMode(runner, 'camera');
  acceptTrackingFrame(runner, true);
  startRunner(runner);
  advanceRunner(runner, 3);
  acceptTrackingFrame(runner, true, ['smile']);
  assert.equal(runner.world.grounded, true);
  assert.equal(acceptTrackingFrame(runner, false, ['blink']), false);
  assert.equal(runner.phase, 'paused');
  assert.equal(runner.reason, 'face');
  assert.equal(startRunner(runner), false);
  assert.equal(acceptTrackingFrame(runner, true, ['blink']), false);
  assert.equal(runner.phase, 'paused');
  assert.equal(startRunner(runner), true);
  selectRunnerMode(runner, 'manual');
  assert.equal(runner.phase, 'paused');
  assert.equal(startRunner(runner), true);
  advanceRunner(runner, 3);
  assert.equal(runnerJump(runner), true);
  assert.equal(runnerJump(runner), false);
});

test('scores persist in the existing Leaderboard format and new records require a higher score', () => {
  const data = new Map();
  const storage = { getItem: key => data.get(key), setItem: (key, value) => data.set(key, value) };
  assert.deepEqual(saveScore('runner', 84, storage), { high: 84, record: true, saved: true });
  assert.deepEqual(saveScore('runner', 10, storage), { high: 84, record: false, saved: true });
  assert.deepEqual(saveScore('runner', 84, storage), { high: 84, record: false, saved: true });
  assert.deepEqual(saveScore('racer', 100, storage), { high: 100, record: true, saved: true });
  assert.equal(highScore('runner', readScores(storage)), 84);
  assert.equal(readScores(storage).length, 4);
  assert.deepEqual(saveScore('runner', 90, { ...storage, setItem() { throw Error('blocked'); } }), { high: 90, record: true, saved: false });
  assert.equal(highScore('runner', readScores(storage)), 84);
});
