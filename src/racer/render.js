import { arena, laneX, playerCar, shieldTime, vehicleY } from './engine.js';

const { width, height, laneWidth, roadLeft, playerY } = arena;
const roadRight = roadLeft + laneWidth * 3;
const palette = {
  cyan: ['#195773', '#8cf5ff', '#253464'],
  violet: ['#59377c', '#c5a5ff', '#281b48'],
  amber: ['#754829', '#ffc47a', '#46303d'],
  rose: ['#693151', '#ff9ec7', '#491e4b'],
};

function polygon(ctx, points, color, outline) {
  ctx.beginPath();
  ctx.moveTo(...points[0]);
  for (const point of points.slice(1)) ctx.lineTo(...point);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  if (outline) { ctx.strokeStyle = outline; ctx.lineWidth = 1.6; ctx.stroke(); }
}

function city(ctx, distance) {
  ctx.fillStyle = '#111128';
  ctx.fillRect(0, 0, width, height);
  const block = 118;
  const scroll = distance * .63;
  const first = Math.floor((-scroll + 70) / block);
  for (let index = first - 1; index <= first + 5; index++) {
    const y = index * block + scroll;
    for (const side of [0, 1]) {
      const span = 77 + Math.abs((index * 21 + side * 17) % 28);
      const top = y + 11;
      const x = side === 0 ? 15 : width - span - 15;
      ctx.fillStyle = '#0b1020'; ctx.fillRect(x + 6, top + 8, span, 92);
      ctx.fillStyle = '#22233c'; ctx.fillRect(x, top, span, 82);
      ctx.strokeStyle = '#3b4862'; ctx.strokeRect(x, top, span, 82);
      ctx.fillStyle = '#292e48'; ctx.fillRect(x + 10, top + 9, span - 20, 33);
      ctx.strokeStyle = '#3b4b72'; ctx.strokeRect(x + 10, top + 9, span - 20, 33);
      for (let col = 9; col < span - 10; col += 12) {
        ctx.fillStyle = (index + col + side) % 3 ? '#4ba0ab' : '#a071c2';
        ctx.fillRect(x + col, top + 54, 4, 11);
      }
      ctx.fillStyle = '#66e1df'; ctx.fillRect(side === 0 ? roadLeft - 15 : roadRight + 12, y + 12, 3, 8);
    }
  }
}

function road(ctx, distance) {
  ctx.fillStyle = '#111a34';
  ctx.fillRect(roadLeft - 7, 0, roadRight - roadLeft + 14, height);
  ctx.fillStyle = '#323d5960';
  ctx.fillRect(roadLeft + laneWidth, 0, laneWidth, height);
  ctx.fillStyle = '#65dce9';
  ctx.fillRect(roadLeft - 3, 0, 2, height);
  ctx.fillRect(roadRight + 1, 0, 2, height);
  ctx.fillStyle = '#81a9c486';
  const offset = distance % 70;
  for (let y = offset - 70; y < height; y += 70) {
    for (const lane of [1, 2]) ctx.fillRect(roadLeft + lane * laneWidth - 1, y, 2, 29);
  }
  const light = ctx.createLinearGradient(roadLeft, 0, roadRight, 0);
  light.addColorStop(0, '#49dce827'); light.addColorStop(.14, '#49dce800');
  light.addColorStop(.86, '#ac73f600'); light.addColorStop(1, '#ac73f628');
  ctx.fillStyle = light; ctx.fillRect(roadLeft, 0, roadRight - roadLeft, height);
}

function car(ctx, x, y, w, h, finish, withShield = false) {
  const [body, edge, glass] = palette[finish];
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(w / 50, h / 76);
  ctx.fillStyle = '#080b19';
  for (const side of [-1, 1]) {
    ctx.fillRect(side * 22 - 5, -24, 10, 16);
    ctx.fillRect(side * 22 - 5, 14, 10, 17);
  }
  polygon(ctx, [[-8, -37], [8, -37], [20, -28], [25, -9], [23, 20], [19, 35], [-19, 35], [-23, 20], [-25, -9], [-20, -28]], body, edge);
  polygon(ctx, [[-13, -12], [13, -12], [16, 1], [12, 17], [-12, 17], [-16, 1]], glass, edge);
  polygon(ctx, [[-11, -10], [11, -10], [13, -2], [-13, -2]], `${edge}78`);
  ctx.fillStyle = edge;
  ctx.fillRect(-17, -28, 9, 4); ctx.fillRect(8, -28, 9, 4);
  ctx.fillRect(-5, -32, 10, 2);
  ctx.fillStyle = '#ff89bf';
  ctx.fillRect(-17, 28, 7, 4); ctx.fillRect(10, 28, 7, 4);
  if (withShield) {
    ctx.beginPath(); ctx.ellipse(0, 0, 34, 45, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#66f7ec1a'; ctx.fill();
    ctx.strokeStyle = '#93fff3'; ctx.lineWidth = 2; ctx.stroke();
  }
  ctx.restore();
}

function drawPickup(ctx, pickup, distance) {
  const x = laneX(pickup.lane);
  const y = vehicleY(pickup, distance);
  if (y < -20 || y > height + 20) return;
  if (pickup.type === 'shield') {
    polygon(ctx, [[x, y - 15], [x + 13, y - 9], [x + 10, y + 8], [x, y + 15], [x - 10, y + 8], [x - 13, y - 9]], '#173a57', '#a1fff7');
    ctx.fillStyle = '#a1fff7'; ctx.fillRect(x - 1, y - 7, 2, 13); ctx.fillRect(x - 5, y - 3, 10, 3);
    return;
  }
  ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2);
  ctx.fillStyle = '#8a592a'; ctx.fill();
  ctx.strokeStyle = '#ffe2a3'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#ffdf9a'; ctx.fillRect(x - 1, y - 5, 2, 10);
}

function particles(ctx, world) {
  for (const burst of world.bursts) {
    const age = (world.seconds - burst.time) / .38;
    ctx.globalAlpha = 1 - age;
    ctx.fillStyle = burst.type === 'coin' ? '#ffe6a9' : '#9effe9';
    for (let index = 0; index < 10; index++) {
      const angle = index * Math.PI / 5;
      const travel = 8 + age * (32 + index % 3 * 8);
      ctx.fillRect(burst.x + Math.cos(angle) * travel, burst.y + Math.sin(angle) * travel, 4, 4);
    }
  }
  ctx.globalAlpha = 1;
}

export function drawRace(ctx, world, reducedMotion) {
  const sceneryDistance = reducedMotion ? 0 : world.distance;
  city(ctx, sceneryDistance);
  road(ctx, sceneryDistance);
  for (const pickup of world.pickups) drawPickup(ctx, pickup, world.distance);
  for (const vehicle of world.traffic) {
    const y = vehicleY(vehicle, world.distance);
    if (y > -52 && y < height + 52) car(ctx, laneX(vehicle.lane), y, vehicle.width, vehicle.height, vehicle.finish);
  }
  car(ctx, world.x, playerY, playerCar.width, playerCar.height, 'cyan', shieldTime(world) > 0);
  if (!reducedMotion) particles(ctx, world);
}
