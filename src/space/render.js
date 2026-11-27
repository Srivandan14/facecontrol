import { arena, entityY, shieldTime } from './engine.js';

const { width, height, shipY } = arena;
const starLayers = [0, 1, 2].map(layer => Array.from({ length: 36 - layer * 6 }, (_, index) => ({
  x: (index * 173 + layer * 63) % width,
  y: (index * index * 41 + layer * 109) % height,
  size: 1 + layer * .55 + (index % 5 === 0 ? .8 : 0),
})));

function shape(ctx, points, fill, stroke) {
  ctx.beginPath();
  ctx.moveTo(...points[0]);
  for (const point of points.slice(1)) ctx.lineTo(...point);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.4; ctx.stroke(); }
}

function glow(ctx, x, y, radius, color) {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, 'transparent');
  ctx.fillStyle = gradient;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

function drawSpace(ctx, time) {
  ctx.fillStyle = '#060917';
  ctx.fillRect(0, 0, width, height);
  glow(ctx, 683, 90, 400, '#512e81ad');
  glow(ctx, 165, 294, 330, '#183680ad');
  glow(ctx, 406, 214, 202, '#82275c58');
  for (const [level, stars] of starLayers.entries()) {
    ctx.fillStyle = ['#898fcb78', '#baa6ffb5', '#b9f6ff'][level];
    const scroll = time * (12 + level * 32);
    for (const star of stars) ctx.fillRect(star.x, (star.y + scroll) % height, star.size, star.size * (level === 2 && time ? 2 : 1));
  }

  const planet = ctx.createLinearGradient(570, 15, 785, 226);
  planet.addColorStop(0, '#8662a8'); planet.addColorStop(.38, '#483068'); planet.addColorStop(1, '#14122e');
  ctx.save();
  ctx.beginPath(); ctx.arc(688, 114, 82, 0, Math.PI * 2); ctx.clip();
  ctx.fillStyle = planet; ctx.fillRect(605, 31, 168, 168);
  ctx.strokeStyle = '#b691d333'; ctx.lineWidth = 4;
  for (let offset = 0; offset < 165; offset += 19) {
    ctx.beginPath(); ctx.ellipse(681, 42 + offset, 120, 17, -.22, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = '#d5b0f189'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.ellipse(688, 113, 125, 23, -.26, .02, Math.PI + .06); ctx.stroke();
  ctx.strokeStyle = '#9c8bdb75';
  ctx.beginPath(); ctx.ellipse(688, 115, 130, 25, -.26, .03, Math.PI + .1); ctx.stroke();
}

function drawShip(ctx, world, reducedMotion) {
  const damaged = world.immuneUntil > world.seconds && shieldTime(world) === 0;
  ctx.save();
  ctx.translate(world.x, shipY);
  const flame = reducedMotion ? 15 : 17 + Math.sin(world.seconds * 32) * 6 + Math.abs(world.velocity) / 26;
  if (!reducedMotion) ctx.rotate(world.velocity / 4900);
  glow(ctx, 0, 25, 62, '#35cced42');
  for (const side of [-1, 1]) {
    shape(ctx, [[side * 7, 18], [side * 17, 21], [side * 13, 23 + flame]], '#638affaf', '#85f9ff');
    shape(ctx, [[side * 10, 17], [side * 14, 20], [side * 12, 25 + flame * .49]], '#e7fdff');
    shape(ctx, [[0, -26], [side * 18, -10], [side * 33, 20], [side * 18, 16], [side * 12, 25], [0, 15]], '#302c59', '#9d8cfa');
    shape(ctx, [[side * 7, -13], [side * 28, 15], [side * 18, 12]], '#6951ab', '#bca0fc');
  }
  shape(ctx, [[0, -37], [12, -18], [17, 12], [9, 24], [-9, 24], [-17, 12], [-12, -18]], '#214b74', damaged ? '#ffa2b5' : '#83f6ff');
  shape(ctx, [[0, -23], [8, -8], [7, 6], [0, 10], [-7, 6], [-8, -8]], '#121934', '#a4fbff');
  shape(ctx, [[0, -19], [5, -7], [0, 1], [-3, -8]], '#89d9f0');
  if (shieldTime(world) > 0) {
    ctx.beginPath(); ctx.ellipse(0, -3, 43, 45, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#7efbff13'; ctx.fill(); ctx.strokeStyle = '#9bf7ff'; ctx.lineWidth = 2; ctx.stroke();
  }
  ctx.restore();
}

function drawAsteroid(ctx, asteroid, y, time) {
  const radius = asteroid.radius;
  const variation = asteroid.shape;
  ctx.save();
  ctx.translate(asteroid.x, y);
  ctx.rotate(variation * 7 + time * (variation - .38));
  const rock = ctx.createLinearGradient(-radius, -radius, radius, radius);
  rock.addColorStop(0, '#9a759e'); rock.addColorStop(.5, '#503a61'); rock.addColorStop(1, '#241934');
  const points = Array.from({ length: 9 }, (_, index) => {
    const angle = index / 9 * Math.PI * 2;
    const edge = radius * (.82 + ((index * 457 + variation * 80) % 29) / 146);
    return [Math.cos(angle) * edge, Math.sin(angle) * edge];
  });
  shape(ctx, points, rock, '#ba89bb');
  shape(ctx, [[-radius * .57, -radius * .13], [-radius * .32, -radius * .38], [radius * .09, -radius * .24], [radius * .03, radius * .04], [-radius * .34, radius * .14]], '#493550', '#99668d');
  shape(ctx, [[radius * .28, radius * .07], [radius * .49, radius * .28], [radius * .24, radius * .49], [radius * .1, radius * .29]], '#352844');
  ctx.restore();
}

function drawPickup(ctx, pickup, y) {
  const x = pickup.x;
  const shield = pickup.type === 'shield';
  const color = shield ? '#8df8ff' : '#a5ffbf';
  glow(ctx, x, y, 40, shield ? '#6df6ef61' : '#87ff9461');
  shape(ctx, [[x, y - 17], [x + 15, y - 8], [x + 15, y + 8], [x, y + 17], [x - 15, y + 8], [x - 15, y - 8]], '#1a3047', color);
  if (shield) shape(ctx, [[x - 6, y - 6], [x + 6, y - 6], [x + 4, y + 4], [x, y + 7], [x - 4, y + 4]], color);
  else { ctx.fillStyle = color; ctx.fillRect(x - 2, y - 8, 4, 16); ctx.fillRect(x - 8, y - 2, 16, 4); }
}

function drawEffects(ctx, world, reducedMotion) {
  for (const effect of world.effects) {
    const age = Math.max(0, (world.seconds - effect.time) / .64);
    if (reducedMotion && effect.type !== 'blast') continue;
    ctx.globalAlpha = reducedMotion ? .44 : 1 - age;
    if (effect.type === 'blast') {
      const radius = effect.radius * (reducedMotion ? 1 : 1 - (1 - age) ** 3 * .88);
      glow(ctx, effect.x, effect.y, radius, '#8b66fb47');
      ctx.strokeStyle = '#bcafff'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(effect.x, effect.y, radius, 0, Math.PI * 2); ctx.stroke();
      continue;
    }
    glow(ctx, effect.x, effect.y, 22 + age * 30, '#ffb1d66a');
    for (let index = 0; index < 12; index++) {
      const angle = index * .524;
      const distance = 6 + age * (42 + index % 4 * 12 + effect.radius);
      const size = (1 - age) * (2 + index % 4);
      ctx.fillStyle = ['#ffa3cf', '#ffd6a3', '#aaa1ff'][index % 3];
      ctx.fillRect(effect.x + Math.cos(angle) * distance, effect.y + Math.sin(angle) * distance, size, size);
    }
  }
  ctx.globalAlpha = 1;
}

export function drawFlight(ctx, world, reducedMotion) {
  const motionTime = reducedMotion ? 0 : world.seconds;
  drawSpace(ctx, motionTime);
  for (const asteroid of world.asteroids) {
    const y = entityY(asteroid, world.seconds);
    if (y >= -asteroid.radius) drawAsteroid(ctx, asteroid, y, motionTime);
  }
  for (const pickup of world.pickups) {
    const y = entityY(pickup, world.seconds);
    if (y >= -22) drawPickup(ctx, pickup, y);
  }
  for (const laser of world.lasers) {
    ctx.fillStyle = '#3dbfe258'; ctx.fillRect(laser.x - 5, laser.y - 6, 10, 27);
    ctx.fillStyle = '#6de0ff'; ctx.fillRect(laser.x - 2, laser.y - 6, 4, 21);
    ctx.fillStyle = '#d7fdff'; ctx.fillRect(laser.x - 1, laser.y - 6, 2, 12);
  }
  drawShip(ctx, world, reducedMotion);
  drawEffects(ctx, world, reducedMotion);
}
