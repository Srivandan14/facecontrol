import { advance, createSession, start } from '../arcade/session.js';

export const arena = { width: 828, height: 540, shipY: 458 };
export const maximumLives = 3;
export const fireInterval = .24;
export const energyCapacity = 100;
export const blastRadius = 260;
const shieldDuration = 10;
const flightSpeed = 360;
const laserSpeed = 650;
const columns = [126, 270, 414, 558, 702];

export function createFormation(previous, random = Math.random) {
  const index = (previous?.index ?? -1) + 1;
  const difficulty = Math.min(1, index / 30);
  const arrival = previous ? previous.arrival + 2.84 - difficulty * 1.14 + random() * .18 : 3.4;
  // Each gap connects to the previous gap with at most one column of travel.
  const candidates = [previous?.safe ?? 2].flatMap(column => [column - 1, column, column + 1]).filter(column => column >= 0 && column < columns.length);
  const safe = candidates[Math.floor(random() * candidates.length)];
  const possible = columns.map((_, column) => column).filter(column => column !== safe);
  const asteroidCount = Math.min(possible.length, 2 + Math.floor(difficulty * 2 + random()));
  const asteroids = [];
  for (let count = 0; count < asteroidCount; count++) {
    const [column] = possible.splice(Math.floor(random() * possible.length), 1);
    asteroids.push({
      x: columns[column], arrival, speed: 145 + 75 * difficulty + random() * 52,
      radius: 24 + random() * 19, shape: random(), removed: false, passed: false,
    });
  }
  const pickup = index % 3 === 2 ? { x: columns[safe], arrival, speed: 174 + 38 * difficulty, type: index % 2 ? 'health' : 'shield', removed: false } : null;
  return { index, arrival, safe, asteroids, pickup, passed: false };
}

export function entityY(entity, seconds) { return arena.shipY + (seconds - entity.arrival) * entity.speed; }
export function shieldTime(world) { return Math.max(0, world.shieldUntil - world.seconds); }

export function createSpaceWorld(random = Math.random) {
  const first = createFormation(null, random);
  return {
    x: arena.width / 2, velocity: 0, seconds: 0, lives: maximumLives, energy: 0, wave: 1,
    destroyed: 0, passed: 0, collected: 0, collided: false, shieldUntil: 0, immuneUntil: 0, nextShot: 0,
    faceInput: { direction: 0, fire: false }, manual: { left: false, right: false, fire: false },
    lastFormation: first, formations: [first], asteroids: [...first.asteroids], pickups: [], lasers: [], effects: [], cue: null, random,
  };
}

function charge(world, points) { world.energy = Math.min(energyCapacity, world.energy + points); }

function effect(world, type, x, y, radius = 0) {
  world.effects.push({ type, x, y, radius, time: world.seconds });
}

function destroy(world, asteroid, chargeEnergy = true) {
  asteroid.removed = true;
  world.destroyed++;
  if (chargeEnergy) charge(world, 20);
  effect(world, 'debris', asteroid.x, entityY(asteroid, world.seconds), asteroid.radius);
}

export function fireLaser(world) {
  if (world.collided || world.seconds + 1e-9 < world.nextShot) return false;
  world.nextShot = world.seconds + fireInterval;
  world.lasers.push({ x: world.x, y: arena.shipY - 30, removed: false });
  world.cue = { type: 'laser' };
  return true;
}

export function useBlast(world) {
  if (world.collided || world.energy < energyCapacity) return false;
  world.energy = 0;
  for (const asteroid of world.asteroids) {
    if (asteroid.removed || asteroid.passed) continue;
    const y = entityY(asteroid, world.seconds);
    if (y >= -asteroid.radius && Math.hypot(asteroid.x - world.x, y - arena.shipY) <= blastRadius + asteroid.radius) destroy(world, asteroid, false);
  }
  effect(world, 'blast', world.x, arena.shipY, blastRadius);
  return true;
}

function moveShip(world, dt) {
  const manualSteering = world.manual.left || world.manual.right;
  const direction = manualSteering ? Number(world.manual.right) - Number(world.manual.left) : world.faceInput.direction;
  const target = direction * flightSpeed;
  const smoothing = direction ? .085 : .045;
  const decay = Math.exp(-dt / smoothing);
  const velocity = world.velocity;
  const proposedX = world.x + target * dt + (velocity - target) * smoothing * (1 - decay);
  world.x = Math.max(31, Math.min(arena.width - 31, proposedX));
  world.velocity = world.x === proposedX ? target + (velocity - target) * decay : 0;
}

function moveLasers(world, step) {
  for (const laser of world.lasers) {
    const before = laser.y;
    laser.y -= laserSpeed * step;
    let first;
    let firstHit = Infinity;
    for (const asteroid of world.asteroids) {
      if (asteroid.removed || asteroid.passed) continue;
      const horizontal = Math.abs(laser.x - asteroid.x);
      if (horizontal > asteroid.radius + 3) continue;
      const reach = Math.sqrt((asteroid.radius + 3) ** 2 - horizontal ** 2);
      const center = entityY(asteroid, world.seconds);
      const from = before - center + asteroid.speed * step;
      const to = laser.y - center;
      if (from < -reach || to > reach) continue;
      const entry = Math.max(0, (from - reach) / (from - to));
      if (entry < firstHit) { first = asteroid; firstHit = entry; }
    }
    if (first) {
      destroy(world, first);
      laser.removed = true;
      world.cue = { type: 'impact' };
    }
  }
}

function collect(world) {
  for (const pickup of world.pickups) {
    const y = entityY(pickup, world.seconds);
    if (pickup.removed || Math.hypot(pickup.x - world.x, y - arena.shipY) > 39) continue;
    pickup.removed = true;
    world.collected++;
    charge(world, 10);
    if (pickup.type === 'shield') world.shieldUntil = world.seconds + shieldDuration;
    else world.lives = Math.min(maximumLives, world.lives + 1);
    effect(world, pickup.type, pickup.x, y);
    world.cue = { type: pickup.type };
  }
}

function checkShip(world) {
  for (const asteroid of world.asteroids) {
    if (asteroid.removed || asteroid.passed) continue;
    const y = entityY(asteroid, world.seconds);
    const dx = Math.max(0, Math.abs(asteroid.x - world.x) - 18);
    const dy = Math.max(0, Math.abs(y - arena.shipY) - 21);
    if (world.seconds >= world.immuneUntil && Math.hypot(dx, dy) < asteroid.radius) {
      asteroid.removed = true;
      const shielded = shieldTime(world) > 0;
      if (shielded) world.shieldUntil = 0;
      else world.lives--;
      world.immuneUntil = world.seconds + .9;
      effect(world, 'debris', asteroid.x, y, asteroid.radius);
      world.cue = { type: shielded ? 'shield' : 'damage' };
      if (!world.lives) { world.collided = true; return; }
    } else if (y - asteroid.radius > arena.shipY + 23) {
      asteroid.passed = true;
      world.passed++;
    }
  }
}

function updateFormations(world) {
  if (world.lastFormation.arrival - world.seconds < 3) {
    const next = createFormation(world.lastFormation, world.random);
    world.lastFormation = next;
    world.formations.push(next);
    world.asteroids.push(...next.asteroids);
    if (next.pickup) world.pickups.push(next.pickup);
  }
  for (const formation of world.formations) {
    if (world.seconds >= formation.arrival - 1.6) world.wave = Math.floor(formation.index / 3) + 1;
    if (world.seconds >= formation.arrival + .52 && !formation.passed) {
      formation.passed = true;
      charge(world, 7);
    }
  }
  world.formations = world.formations.filter(formation => !formation.passed);
}

export function advanceSpaceWorld(world, seconds) {
  while (seconds > 1e-9 && !world.collided) {
    const step = Math.min(seconds, 1 / 120);
    seconds -= step;
    moveShip(world, step);
    if (world.manual.fire || world.faceInput.fire) fireLaser(world);
    world.seconds += step;
    moveLasers(world, step);
    collect(world);
    checkShip(world);
    if (!world.collided) updateFormations(world);
    world.asteroids = world.asteroids.filter(asteroid => !asteroid.removed && entityY(asteroid, world.seconds) - asteroid.radius < arena.height);
    world.pickups = world.pickups.filter(pickup => !pickup.removed && entityY(pickup, world.seconds) < arena.height + 20);
    world.lasers = world.lasers.filter(laser => !laser.removed && laser.y > -30);
    world.effects = world.effects.filter(item => world.seconds - item.time < .64);
  }
}

export function scoreFor(world) {
  return Math.floor(world.seconds * 10) + world.destroyed * 60 + world.passed * 15 + world.collected * 25;
}

export function createSpace(random = Math.random) { return createSession(createSpaceWorld, random); }

export function startSpace(session, restart = false) {
  if (!start(session, restart, createSpaceWorld)) return false;
  session.world.faceInput = { direction: 0, fire: false };
  session.world.manual = { left: false, right: false, fire: false };
  session.world.velocity = 0;
  return true;
}

export function advanceSpace(session, seconds) { advance(session, seconds, advanceSpaceWorld); }
