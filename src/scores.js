const storageKey = 'facecontrol.scores';
export const scoreChangeEvent = 'facecontrol:score-change';

function normalizeRun(item) {
  if (typeof item?.gameId !== 'string' || !Number.isFinite(item.score) || item.score < 0) return null;
  const run = { gameId: item.gameId, score: item.score };
  if (Number.isFinite(item.seconds) && item.seconds >= 0) run.seconds = item.seconds;
  if (item.completed === false) run.completed = false;
  if (typeof item.challengeId === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item.challengeId)) {
    const date = new Date(`${item.challengeId}T00:00:00Z`);
    if (Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === item.challengeId) run.challengeId = item.challengeId;
  }
  return run;
}

export function readRuns(storage) {
  try {
    const items = JSON.parse((storage ?? localStorage).getItem(storageKey));
    return Array.isArray(items) ? items.map(normalizeRun).filter(Boolean) : [];
  } catch { return []; }
}

export function readScores(storage) { return readRuns(storage).filter(run => run.completed !== false); }

export function highScore(gameId, scores = readScores()) {
  return scores.reduce((highest, entry) => entry.gameId === gameId ? Math.max(highest, entry.score) : highest, 0);
}

export function saveScore(gameId, score, storage) {
  return saveRun({ gameId, score }, storage);
}

export function saveRun(details, storage) {
  const run = normalizeRun(details);
  if (!run) return { high: 0, record: false, saved: false };
  const records = readRuns(storage);
  const previous = highScore(run.gameId, records.filter(item => item.completed !== false));
  let saved = false;
  try {
    (storage ?? localStorage).setItem(storageKey, JSON.stringify([...records, run]));
    saved = true;
  } catch { /* The finished run remains visible even if browser storage is disabled. */ }
  if (saved && !storage && typeof window !== 'undefined') window.dispatchEvent(new Event(scoreChangeEvent));
  return { high: run.completed === false ? previous : Math.max(previous, run.score), record: run.completed !== false && run.score > previous, saved };
}
