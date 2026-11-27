import { advance, canAct, createSession, observeFace, start } from '../arcade/session.js';
export { isActive as isRunnerActive, pause as pauseRunner, selectMode as selectRunnerMode } from '../arcade/session.js';

export const arena = { width: 960, height: 420, ground: 332 };
export const robot = { x: 150, width: 48, height: 52 };
const gravity = 1780;
const jumpSpeed = 685;
const maximumSpeed = 640;
const gapTime = jumpSpeed * 2 / gravity + .36;

export function runSpeed(seconds) {
  return Math.min(maximumSpeed, 305 + seconds * 5);
}

export function createObstacle(previous, seconds, random = Math.random) {
  const difficulty = (runSpeed(seconds) - 305) / (maximumSpeed - 305);
  const width = Math.floor(33 + random() * (18 + difficulty * 13));
  const height = Math.floor(30 + random() * (22 + difficulty * 23));
  const safeSpeed = Math.min(maximumSpeed, runSpeed(seconds) + 30);
  const gap = safeSpeed * (gapTime + random() * (.85 - difficulty * .57));
  const x = previous ? previous.x + previous.width + gap : arena.width + 72;
  return { x, width, height, style: random() < .5 ? 'amber' : 'pink', cleared: false };
}

export function createWorld(random = Math.random) {
  return {
    y: 0, velocity: 0, grounded: true, seconds: 0, distance: 0,
    cleared: 0, collided: false, obstacles: [createObstacle(null, 0, random)], random,
  };
}

export function jump(world) {
  if (!world.grounded || world.collided) return false;
  world.velocity = jumpSpeed;
  world.grounded = false;
  return true;
}

function playerBounds(world) {
  const feet = arena.ground - world.y;
  return { left: robot.x + 5, right: robot.x + robot.width - 5, top: feet - robot.height + 4, bottom: feet - 2 };
}

export function hitsObstacle(world, obstacle) {
  const { left, right, top, bottom } = playerBounds(world);
  return left < obstacle.x + obstacle.width - 3 && right > obstacle.x + 3
    && bottom > arena.ground - obstacle.height + 2 && top < arena.ground;
}

export function scoreFor(world) {
  return Math.floor(world.seconds * 10) + world.cleared * 50;
}

export function advanceWorld(world, seconds) {
  // Small steps keep collisions reliable when a browser frame arrives late.
  while (seconds > 0 && !world.collided) {
    const step = Math.min(seconds, 1 / 120);
    seconds -= step;
    const distance = runSpeed(world.seconds + step / 2) * step;
    world.seconds += step;
    world.distance += distance;
    if (!world.grounded) {
      world.y += world.velocity * step - gravity * step * step / 2;
      world.velocity -= gravity * step;
      if (world.y <= 0) {
        world.y = 0;
        world.velocity = 0;
        world.grounded = true;
      }
    }

    for (const obstacle of world.obstacles) {
      obstacle.x -= distance;
      if (hitsObstacle(world, obstacle)) world.collided = true;
      if (!obstacle.cleared && obstacle.x + obstacle.width <= playerBounds(world).left) {
        obstacle.cleared = true;
        world.cleared++;
      }
    }
    const last = world.obstacles.at(-1);
    if (last.x < arena.width) world.obstacles.push(createObstacle(last, world.seconds, world.random));
    if (world.obstacles[0].x + world.obstacles[0].width < 0) world.obstacles.shift();
  }
}

export function createRunner(random = Math.random) {
  return createSession(createWorld, random);
}

export function startRunner(runner, restart = false) {
  return start(runner, restart, createWorld);
}

export function runnerJump(runner) {
  return canAct(runner) && jump(runner.world);
}

export function acceptTrackingFrame(runner, face, triggered = []) {
  return observeFace(runner, face) && triggered.includes('blink') && runnerJump(runner);
}

export function advanceRunner(runner, seconds) {
  advance(runner, seconds, advanceWorld);
}

