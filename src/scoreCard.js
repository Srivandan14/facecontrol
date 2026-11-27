import { formatPlaytime, gameDetails } from './progress.js';

export function scoreCardLines(run) {
  if (!Object.hasOwn(gameDetails, run.gameId) || !Number.isFinite(run.score) || run.score < 0 || run.completed === false) throw new Error('A completed arcade run is required.');
  return [gameDetails[run.gameId].title, run.score.toLocaleString(), ...(run.seconds == null ? [] : [formatPlaytime(run.seconds) + ' playtime']), ...(run.challengeId ? ['Daily challenge ' + run.challengeId + ' UTC'] : [])];
}

export function downloadScoreCard(run) {
  const [title, score, ...details] = scoreCardLines(run);
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 630;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser cannot create a score card.');
  const gradient = ctx.createLinearGradient(0, 0, 1200, 630);
  gradient.addColorStop(0, '#101024'); gradient.addColorStop(1, '#251641');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 1200, 630);
  ctx.strokeStyle = '#6a468a'; ctx.lineWidth = 2; ctx.strokeRect(36, 36, 1128, 558);
  ctx.strokeStyle = '#614783';
  for (let index = 0; index < 7; index++) {
    ctx.beginPath(); ctx.arc(954, 328, 55 + index * 20, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.fillStyle = '#8feef0'; ctx.fillRect(924, 298, 60, 60);
  ctx.fillStyle = '#b497f5'; ctx.font = '700 28px monospace'; ctx.fillText('FACECONTROL / ARCADE RECORD', 90, 126);
  ctx.fillStyle = '#f2edff'; ctx.font = '700 56px system-ui'; ctx.fillText(title, 90, 217);
  ctx.fillStyle = '#8af5f4'; ctx.font = '800 114px system-ui'; ctx.fillText(score, 82, 366);
  ctx.fillStyle = '#d8c6f8'; ctx.font = '600 29px system-ui'; ctx.fillText('Points scored', 90, 422);
  ctx.font = '500 24px system-ui';
  details.forEach((line, index) => ctx.fillText(line, 90, 485 + index * 37));
  const link = document.createElement('a');
  link.href = canvas.toDataURL('image/png');
  if (!link.href.startsWith('data:image/png')) throw new Error('The image could not be generated.');
  link.download = `facecontrol-${gameDetails[run.gameId].route}-${run.score}.png`;
  document.body.append(link);
  try { link.click(); } finally { link.remove(); }
}
