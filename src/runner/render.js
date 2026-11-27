import { arena, robot } from './engine.js';

const { width, height, ground } = arena;
const buildingLayers = [
  { step: 64, drift: .14, bottom: 309, color: '#181638', edge: '#33285b' },
  { step: 51, drift: .30, bottom: 327, color: '#19132d', edge: '#55366e' },
];

function polygon(ctx, points, color, outline) {
  ctx.beginPath();
  ctx.moveTo(...points[0]);
  for (const point of points.slice(1)) ctx.lineTo(...point);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  if (outline) { ctx.strokeStyle = outline; ctx.lineWidth = 1.5; ctx.stroke(); }
}

function drawSky(ctx, distance) {
  const sky = ctx.createLinearGradient(0, 0, 0, ground);
  sky.addColorStop(0, '#0d0922');
  sky.addColorStop(.65, '#271042');
  sky.addColorStop(1, '#461c50');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = '#caa7fc8a';
  for (let i = 0; i < 60; i++) {
    const x = (i * 1531 % 974 - distance * .04 + width) % width;
    const y = 14 + i * 999 % 201;
    ctx.fillRect((x + width) % width, y, i % 6 === 0 ? 2 : 1, 1);
  }

  const planet = ctx.createLinearGradient(0, 51, 0, 210);
  planet.addColorStop(0, '#f9abde');
  planet.addColorStop(1, '#aa4baf');
  ctx.save();
  ctx.beginPath();
  ctx.arc(735, 169, 93, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = planet;
  ctx.fillRect(640, 74, 190, 190);
  ctx.fillStyle = '#3d184a';
  for (let y = 146; y < 264; y += 12) ctx.fillRect(640, y, 190, 2 + (y - 146) * .05);
  ctx.restore();

  for (const [layerIndex, { step, drift, bottom, color, edge }] of buildingLayers.entries()) {
    const travel = distance * drift;
    const first = Math.floor(travel / step);
    for (let index = first; index <= first + Math.ceil(width / step); index++) {
      const x = index * step - travel;
      const building = step - 4 - index * 23 % 9;
      const tall = 23 + (index * 61 + layerIndex * 79) % (layerIndex === 0 ? 110 : 83);
      const y = bottom - tall;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, building, ground - y);
      ctx.fillStyle = edge;
      ctx.fillRect(x, y, building, 1);
      if (index % 4 === 0) ctx.fillRect(x + building / 2, y - 13, 1, 13);
      for (let row = y + 8; row < bottom - 2; row += 10) {
        for (let col = 6; col < building - 4; col += 9) {
          if ((index + row + col) % 5 < 2) ctx.fillRect(x + col, row, 3, 2);
        }
      }
    }
  }
}

function drawTrack(ctx, distance) {
  const asphalt = ctx.createLinearGradient(0, ground, 0, height);
  asphalt.addColorStop(0, '#17132d');
  asphalt.addColorStop(1, '#0a0818');
  ctx.fillStyle = asphalt;
  ctx.fillRect(0, ground, width, height - ground);
  ctx.beginPath();
  const offset = distance % 64;
  for (let x = -64; x < width + 90; x += 64) {
    ctx.moveTo(x - offset, ground);
    ctx.lineTo(x - offset - 46, height);
  }
  for (const y of [346, 365, 390, 418]) { ctx.moveTo(0, y); ctx.lineTo(width, y); }
  ctx.strokeStyle = '#62418467';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = '#b979fa';
  ctx.fillRect(0, ground - 1, width, 2);
  ctx.fillStyle = '#dd99fc80';
  ctx.fillRect(0, ground + 4, width, 1);
}

function drawRobot(ctx, world, animate) {
  const stride = animate && world.grounded && world.seconds > 0 ? Math.sin(world.distance / 12) * 3 : 0;
  ctx.fillStyle = world.grounded ? '#d581ff76' : '#d581ff42';
  ctx.beginPath();
  ctx.ellipse(robot.x + 25, ground + 4, 25 - Math.min(13, world.y / 12), 4, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(robot.x, ground - world.y - robot.height);
  polygon(ctx, [[11, 34], [21, 36], [19, 48 + stride], [9, 51 + stride], [5, 47 + stride]], '#3b285d', '#aa82ef');
  polygon(ctx, [[27, 35], [35, 33], [41, 46 - stride], [39, 51 - stride], [27, 51 - stride], [26, 43]], '#594180', '#bc9aff');
  polygon(ctx, [[8, 23], [35, 21], [42, 30], [37, 41], [13, 41], [7, 34]], '#382861', '#b395ff');
  polygon(ctx, [[3, 11], [12, 4], [31, 4], [44, 11], [46, 23], [40, 29], [8, 29], [3, 23]], '#60509b', '#d7bcff');
  polygon(ctx, [[13, 12], [39, 12], [43, 16], [42, 23], [13, 23], [10, 19]], '#181b3b', '#73e8f0');
  ctx.fillStyle = '#94f8ff';
  ctx.fillRect(20, 16, 6, 3);
  ctx.fillRect(31, 16, 6, 3);
  ctx.fillRect(19, 31, 10, 3);
  ctx.fillStyle = '#ec9df9';
  ctx.fillRect(4, 32, 5, 4);
  ctx.fillRect(24, 0, 2, 5);
  ctx.fillRect(22, 0, 6, 2);
  ctx.restore();
}

function drawObstacle(ctx, { x, width: size, height: tall, style }) {
  const top = ground - tall;
  const neon = style === 'amber' ? '#ffd08d' : '#f990db';
  polygon(ctx, [[x, ground], [x, top + 8], [x + 8, top], [x + size - 8, top], [x + size, top + 8], [x + size, ground]], '#311c48', neon);
  ctx.fillStyle = neon;
  ctx.fillRect(x + 8, top + 8, size - 16, 3);
  for (let stripe = 8; stripe < size - 10; stripe += 10) {
    polygon(ctx, [[x + stripe, top + 17], [x + stripe + 5, top + 17], [x + stripe + 1, ground - 6], [x + stripe - 3, ground - 6]], `${neon}9a`);
  }
}

export function drawRun(ctx, world, reducedMotion) {
  drawSky(ctx, reducedMotion ? 0 : world.distance);
  drawTrack(ctx, reducedMotion ? 0 : world.distance);
  for (const obstacle of world.obstacles) {
    if (obstacle.x < width && obstacle.x + obstacle.width > 0) drawObstacle(ctx, obstacle);
  }
  drawRobot(ctx, world, !reducedMotion);
}
