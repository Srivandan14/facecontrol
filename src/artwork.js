const TAU = Math.PI * 2;

function path(ctx, points, stroke, weight = 1, fill) {
  ctx.beginPath();
  points.forEach(([x, y], index) => index === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
  if (fill) { ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = weight; ctx.stroke(); }
}

function ellipse(ctx, x, y, rx, ry, stroke, weight = 1, tilt = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, tilt, 0, TAU);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = weight;
  ctx.stroke();
}

function glow(ctx, x, y, radius, color) {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, 'transparent');
  ctx.fillStyle = gradient;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

function stars(ctx, width, height, tint, count = 72) {
  for (let index = 1; index <= count; index++) {
    const x = ((index * 1697) % 997) / 997 * width;
    const y = ((index * index * 1117) % 991) / 991 * height;
    ctx.globalAlpha = 0.14 + index % 6 * .105;
    ctx.fillStyle = tint;
    ctx.fillRect(x, y, index % 8 === 0 ? 2 : 1, index % 8 === 0 ? 2 : 1);
  }
  ctx.globalAlpha = 1;
}

function face(ctx) {
  glow(ctx, 326, 214, 218, '#271769');
  glow(ctx, 363, 180, 148, '#281666');
  stars(ctx, 620, 411, '#a38dff', 85);

  ctx.setLineDash([2, 5]);
  ellipse(ctx, 334, 208, 154, 155, '#6349a4');
  ellipse(ctx, 334, 208, 183, 184, '#543c84');
  ctx.setLineDash([]);
  ellipse(ctx, 334, 208, 167, 167, '#9752ed55');
  ellipse(ctx, 333, 215, 195, 60, '#724ed764', 1, -.47);
  ellipse(ctx, 333, 215, 196, 62, '#602aab5c', 1, .4);

  // Horizontal cross-sections of an illustrated face, from crown to chin.
  const rings = [[88, 12, 18], [93, 38, 34], [105, 59, 50], [124, 73, 60], [147, 80, 64], [171, 80, 64], [192, 79, 62], [212, 75, 59], [233, 72, 56], [254, 65, 51], [275, 55, 45], [291, 43, 36], [305, 29, 27], [313, 12, 17]];
  const columns = 30;
  const points = rings.map(([y, width, depth]) => Array.from({ length: columns }, (_, column) => {
    const angle = column / columns * TAU;
    const x = Math.sin(angle) * width;
    const front = Math.max(0, Math.cos(angle));
    const nose = 25 * Math.exp(-((y - 211) ** 2) / 385 - (x ** 2) / 260) * front;
    const eyeSockets = 12 * Math.exp(-((y - 184) ** 2) / 210 - ((Math.abs(x) - 31) ** 2) / 235) * front;
    const mouth = 8 * Math.exp(-((y - 255) ** 2) / 160 - (x ** 2) / 740) * front;
    const z = Math.cos(angle) * depth + nose - eyeSockets + mouth;
    return { x: 326 + .91 * x + .39 * z, y: y + .105 * z - .05 * x, z: .91 * z - .39 * x };
  }));

  const meshColor = ctx.createLinearGradient(255, 304, 403, 98);
  meshColor.addColorStop(0, '#8654fc');
  meshColor.addColorStop(.52, '#bb86ff');
  meshColor.addColorStop(1, '#5beef5');
  const silhouette = points.map(ring => ring.reduce((left, point) => point.x < left.x ? point : left));
  silhouette.push(...points.map(ring => ring.reduce((right, point) => point.x > right.x ? point : right)).reverse());
  path(ctx, silhouette.map(point => [point.x, point.y]), meshColor, 1.15, '#170c42');

  ctx.shadowColor = '#935bff'; ctx.shadowBlur = 8;
  points.forEach((ring, row) => ring.forEach((point, column) => {
    const nextColumn = (column + 1) % columns;
    const neighbors = [ring[nextColumn], points[row + 1]?.[column], points[row + 1]?.[nextColumn]];
    neighbors.forEach((next, index) => {
      if (!next || point.z + next.z < -13) return;
      ctx.globalAlpha = index === 2 ? .27 : .62;
      path(ctx, [[point.x, point.y], [next.x, next.y]], meshColor, index === 2 ? .6 : .85);
    });
    if (point.z > 27 && (row + column) % 3 === 0) {
      ctx.globalAlpha = .85;
      ctx.fillStyle = '#d7baff'; ctx.fillRect(point.x - .7, point.y - .7, 1.4, 1.4);
    }
  }));
  ctx.globalAlpha = 1; ctx.shadowBlur = 0;

  path(ctx, [[296, 185], [299, 182], [306, 182], [315, 187], [304, 189], [296, 185]], '#c8abff', .8);
  path(ctx, [[339, 185], [350, 178], [363, 180], [368, 184], [356, 188], [339, 185]], '#d7b8ff', .95);
  path(ctx, [[331, 253], [338, 249], [346, 252], [353, 250], [365, 251], [355, 257], [342, 258], [331, 253]], '#d7aaff', .88);

  [[219, 112, 1, 1], [459, 112, -1, 1], [219, 303, 1, -1], [459, 303, -1, -1]].forEach(([x, y, dx, dy]) => {
    path(ctx, [[x, y + 17 * dy], [x, y], [x + 17 * dx, y]], '#9c7be4', 1.2);
  });

  path(ctx, [[214, 154], [187, 132], [132, 132]], '#7757c3', .9);
  path(ctx, [[455, 233], [485, 213], [530, 213]], '#56d3de8f', .9);
  [[214, 154, '#a77dff'], [455, 233, '#5ff3fd'], [391, 48, '#a57dff'], [243, 352, '#b877ff'], [494, 121, '#956bff']].forEach(([x, y, color]) => {
    glow(ctx, x, y, 10, color);
    ctx.fillStyle = color; ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
  });
}

function ground(ctx, horizon, color, center = 180) {
  for (let x = -330; x < 710; x += 55) path(ctx, [[center + (x - center) * .07, horizon], [x, 190]], color);
  for (const y of [2, 7, 14, 25, 41, 63, 89]) path(ctx, [[0, horizon + y], [360, horizon + y]], color);
}

function runner(ctx) {
  const bg = ctx.createLinearGradient(0, 0, 0, 188);
  bg.addColorStop(0, '#200e42'); bg.addColorStop(.58, '#472078'); bg.addColorStop(1, '#100e2a');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, 360, 188);
  glow(ctx, 235, 89, 94, '#a736a77f');
  stars(ctx, 360, 126, '#dac3fc', 54);
  ctx.save(); ctx.beginPath(); ctx.arc(241, 100, 41, 0, TAU); ctx.clip();
  const sun = ctx.createLinearGradient(0, 58, 0, 140);
  sun.addColorStop(0, '#ffb694'); sun.addColorStop(1, '#df49e7');
  ctx.fillStyle = sun; ctx.fillRect(194, 58, 94, 76);
  for (let y = 101; y < 138; y += 7) { ctx.fillStyle = '#602484'; ctx.fillRect(190, y, 100, (y - 95) / 10); }
  ctx.restore();
  ctx.fillStyle = '#201239';
  for (let x = 0; x < 360; x += 13) {
    const height = (x * 17 % 38) + 9;
    ctx.fillRect(x, 129 - height, 9, height);
    ctx.fillStyle = '#b167eb65'; ctx.fillRect(x + 5, 132 - height, 1, Math.min(14, height - 3)); ctx.fillStyle = '#201239';
  }
  path(ctx, [[0, 129], [360, 129], [360, 188], [0, 188]], '#d663fc', 1, '#170b2b');
  ground(ctx, 130, '#a54cdb5b');
  path(ctx, [[0, 169], [205, 169], [223, 179], [360, 179]], '#c855ff', 1.1);
  path(ctx, [[220, 169], [234, 138], [249, 169], [258, 151], [268, 169]], '#ef7bf3', 1.4, '#603490');
  ctx.save(); ctx.translate(156, 121); ctx.rotate(-.19);
  ctx.shadowColor = '#e88cff'; ctx.shadowBlur = 18;
  path(ctx, [[-14, -14], [12, -14], [12, 12], [-14, 12]], '#f8b8ff', 2, '#7334bf');
  ctx.shadowBlur = 0;
  path(ctx, [[-9, -9], [7, -9], [7, 7], [-9, 7], [-9, -9]], '#ed84ff', 1);
  ctx.fillStyle = '#f6dbff'; ctx.fillRect(-5, -3, 3, 3); ctx.fillRect(3, -3, 3, 3);
  ctx.restore();
  path(ctx, [[104, 142], [127, 136], [137, 126]], '#ea5effa0', 1.3);
}

function racer(ctx) {
  const bg = ctx.createLinearGradient(0, 0, 0, 188);
  bg.addColorStop(0, '#052030'); bg.addColorStop(.65, '#12354c'); bg.addColorStop(1, '#071821');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, 360, 188);
  glow(ctx, 185, 96, 114, '#1ed1c86b');
  stars(ctx, 360, 120, '#66e6ec', 70);
  path(ctx, [[0, 113], [47, 68], [83, 97], [111, 78], [149, 105], [187, 113]], '#42deed93', 1, '#103044');
  path(ctx, [[188, 113], [239, 96], [272, 67], [308, 92], [337, 69], [360, 92], [360, 113]], '#42deed93', 1, '#102941');
  ground(ctx, 112, '#21acbe62');
  path(ctx, [[159, 112], [205, 112], [298, 188], [62, 188]], '#44f6ee', 2, '#0d2739');
  [[116, 5, 7], [129, 9, 10], [150, 14, 11], [178, 19, 9]].forEach(([y, size, height]) => path(ctx, [[181 - size * .3, y], [181 + size * .3, y], [182 + size * .5, y + height], [182 - size * .5, y + height]], null, 0, '#62d8d5a3'));
  ctx.shadowColor = '#3adffa'; ctx.shadowBlur = 13;
  path(ctx, [[119, 153], [129, 131], [149, 124], [161, 111], [204, 109], [220, 123], [241, 132], [250, 150], [239, 163], [133, 163]], '#63eaff', 1.6, '#142a4f');
  ctx.shadowBlur = 0;
  path(ctx, [[148, 125], [165, 114], [201, 113], [216, 125]], '#81dbf4', 1, '#31789c');
  path(ctx, [[133, 132], [154, 137], [214, 137], [237, 132], [244, 147], [123, 148]], '#56adb7', 1, '#16395a');
  path(ctx, [[135, 143], [152, 145], [160, 151], [134, 148]], '#ffa2c8', 1, '#ff4389');
  path(ctx, [[232, 143], [215, 145], [207, 151], [233, 148]], '#ffa2c8', 1, '#ff4389');
  path(ctx, [[127, 156], [144, 159], [224, 159], [242, 155]], '#56defc', 1.2);
}

function space(ctx) {
  ctx.fillStyle = '#110d2e'; ctx.fillRect(0, 0, 360, 188);
  glow(ctx, 245, 62, 150, '#672792a5');
  glow(ctx, 80, 150, 125, '#302b8b9e');
  stars(ctx, 360, 188, '#e0baff', 100);
  const planet = ctx.createLinearGradient(210, 12, 315, 136);
  planet.addColorStop(0, '#d092fd'); planet.addColorStop(.43, '#6746b9'); planet.addColorStop(1, '#1c123b');
  ctx.beginPath(); ctx.arc(266, 68, 46, 0, TAU); ctx.fillStyle = planet; ctx.fill();
  ellipse(ctx, 266, 69, 71, 15, '#cfa5ffba', 1.1, -.29);
  ellipse(ctx, 266, 69, 75, 18, '#aa87ee73', 1, -.29);
  path(ctx, [[64, 157], [106, 137], [104, 151], [65, 166]], '#955dffab', 1, '#592bdc82');
  path(ctx, [[104, 130], [136, 100], [168, 103], [195, 91], [210, 94], [181, 125], [155, 136], [131, 164], [155, 139], [106, 151]], '#ecaaff', 1.5, '#502d88');
  path(ctx, [[107, 138], [163, 111], [203, 95], [176, 124], [138, 136]], '#e5a9ff', 1.1, '#b682fb');
  path(ctx, [[143, 123], [158, 111], [177, 107], [168, 117]], '#9ee8ff', 1, '#3977b9');
  path(ctx, [[135, 124], [123, 123], [132, 117], [140, 120]], '#e59cff', 1, '#8047be');
  path(ctx, [[216, 89], [237, 79]], '#88f5ff', 1.75);
  path(ctx, [[225, 100], [243, 93]], '#d692ff', 1.4);
}

const scenes = { hero: face, runner, racer, space };

export function drawArtwork(ctx, variant, width, height) {
  const isHero = variant === 'hero';
  const sourceWidth = isHero ? 620 : 360;
  const sourceHeight = isHero ? 411 : 188;
  const scale = isHero ? Math.min(width / sourceWidth, height / sourceHeight) : Math.max(width / sourceWidth, height / sourceHeight);
  ctx.save();
  ctx.translate((width - sourceWidth * scale) / 2, (height - sourceHeight * scale) / 2);
  ctx.scale(scale, scale);
  scenes[variant](ctx);
  ctx.restore();
}
