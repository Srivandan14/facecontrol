import { advance, canAct, createSession, observeFace, start } from '../arcade/session.js';

export const arena = { width: 640, height: 560, roadLeft: 146, laneWidth: 116, playerY: 449 };
export const playerCar = { width: 50, height: 76 };
export const laneDuration = .26;
export const shieldDuration = 9;
const topSpeed = 485;
const maxTrafficWindow = 110;
// The extra time lets the player react and return to neutral between two tilts.
const laneChangeWindow = laneDuration * 2 + .90;
const lanes = [0, 1, 2];
const finishes = ['violet', 'amber', 'rose'];

export function roadSpeed(seconds) { return Math.min(topSpeed, 225 + seconds * 3.2); }
export function laneX(lane) { return arena.roadLeft + (lane + .5) * arena.laneWidth; }
export function vehicleY(entity, distance) { return arena.playerY + (distance - entity.arrival) * entity.pace; }
export function shieldTime(world) { return Math.max(0, world.shieldUntil - world.seconds); }

export function createWave(previous, seconds, random = Math.random) {
  const difficulty = (roadSpeed(seconds) - 225) / (topSpeed - 225);
  const minGap = 2 * maxTrafficWindow + topSpeed * laneChangeWindow;
  const arrival = previous ? previous.arrival + minGap + 280 * (1 - difficulty) + 125 * random() : 710;
  const safeLane = Math.floor(random() * lanes.length);
  const candidates = lanes.filter(lane => lane !== safeLane);
  const blocked = random() < .23 + .67 * difficulty ? candidates : [candidates[Math.floor(random() * candidates.length)]];
  const index = (previous?.index ?? -1) + 1;
  const nextShield = previous?.nextShield ?? 3;
  const grantShield = index === nextShield;

  return {
    index, arrival, safeLane, nextShield: grantShield ? index + 4 + Math.floor(random() * 3) : nextShield,
    traffic: blocked.map(lane => ({
      lane, arrival, pace: .78 + random() * .48, width: 45 + random() * 10, height: 66 + random() * 22,
      finish: finishes[Math.floor(random() * finishes.length)], spent: false, passed: false,
    })),
    pickups: [-62, 0, 62].map((offset, position) => ({
      lane: safeLane, arrival: arrival + offset, pace: 1, type: grantShield && position === 1 ? 'shield' : 'coin', spent: false,
    })),
  };
}

export function createRaceWorld(random = Math.random) {
  const lastWave = createWave(null, 0, random);
  return {
    x: laneX(1), lane: 1, change: null, seconds: 0, distance: 0,
    overtakes: 0, coins: 0, shieldUntil: 0, shieldBlocks: 0, collided: false,
    lastWave, traffic: [...lastWave.traffic], pickups: [...lastWave.pickups], bursts: [], cue: null, random,
  };
}

export function moveLane(world, direction) {
  if (world.collided || (direction !== -1 && direction !== 1)) return false;
  const next = world.lane + direction;
  if (next < 0 || next > 2) return false;
  world.lane = next;
  const x = laneX(next);
  world.change = { from: world.x, to: x, elapsed: 0, duration: laneDuration * Math.abs(x - world.x) / arena.laneWidth };
  return true;
}

export function trafficCollision(world, car) {
  const x = Math.abs(world.x - laneX(car.lane));
  const y = Math.abs(arena.playerY - vehicleY(car, world.distance));
  return x < (playerCar.width + car.width) / 2 - 7 && y < (playerCar.height + car.height) / 2 - 7;
}

export function scoreFor(world) {
  return Math.floor(world.seconds * 10) + world.overtakes * 35 + world.coins * 20;
}

function collectPickups(world) {
  for (const pickup of world.pickups) {
    const y = vehicleY(pickup, world.distance);
    if (pickup.spent || Math.abs(world.x - laneX(pickup.lane)) > 31 || Math.abs(y - arena.playerY) > 43) continue;
    pickup.spent = true;
    if (pickup.type === 'shield') {
      world.shieldUntil = world.seconds + shieldDuration;
    } else world.coins++;
    world.cue = { type: pickup.type };
    world.bursts.push({ x: laneX(pickup.lane), y, type: pickup.type, time: world.seconds });
  }
}

function checkTraffic(world) {
  for (const car of world.traffic) {
    if (car.spent || car.passed) continue;
    if (trafficCollision(world, car)) {
      if (shieldTime(world) <= 0) { world.collided = true; return; }
      world.shieldUntil = 0;
      world.shieldBlocks++;
      car.spent = true;
      world.cue = { type: 'shield' };
      world.bursts.push({ x: world.x, y: arena.playerY, type: 'shield', time: world.seconds });
      continue;
    }
    const rear = vehicleY(car, world.distance) - car.height / 2;
    if (rear > arena.playerY + playerCar.height / 2) {
      car.passed = true;
      world.overtakes++;
    }
  }
}

export function advanceRaceWorld(world, seconds) {
  while (seconds > 0 && !world.collided) {
    const dt = Math.min(seconds, 1 / 120);
    seconds -= dt;
    world.distance += roadSpeed(world.seconds + dt / 2) * dt;
    world.seconds += dt;
    const change = world.change;
    if (change) {
      change.elapsed += dt;
      const progress = change.duration ? Math.min(1, change.elapsed / change.duration) : 1;
      const ease = progress * progress * (3 - 2 * progress);
      world.x = change.from + (change.to - change.from) * ease;
      if (progress === 1) world.change = null;
    }

    collectPickups(world);
    checkTraffic(world);
    if (world.lastWave.arrival - world.distance < 970) {
      world.lastWave = createWave(world.lastWave, world.seconds, world.random);
      world.traffic.push(...world.lastWave.traffic);
      world.pickups.push(...world.lastWave.pickups);
    }
    world.traffic = world.traffic.filter(car => !car.spent && vehicleY(car, world.distance) < arena.height + 60);
    world.pickups = world.pickups.filter(pickup => !pickup.spent && vehicleY(pickup, world.distance) < arena.height + 20);
    world.bursts = world.bursts.filter(burst => world.seconds - burst.time < .38);
  }
}

export function createRace(random = Math.random) { return createSession(createRaceWorld, random); }
export function startRace(race, restart = false) { return start(race, restart, createRaceWorld); }
export function advanceRace(race, seconds) { advance(race, seconds, advanceRaceWorld); }
export function steer(race, direction) { return canAct(race) && moveLane(race.world, direction); }

export function acceptRaceTracking(race, face, triggered = []) {
  if (!observeFace(race, face)) return false;
  // The shared detector reports the player's physical left/right. Mirroring
  // the video is display-only, so the car moves in that same screen direction.
  const direction = Number(triggered.includes('tiltRight')) - Number(triggered.includes('tiltLeft'));
  return steer(race, direction);
}
