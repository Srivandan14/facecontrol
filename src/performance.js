export function handheldDevice() {
  return window.matchMedia('(pointer: coarse)').matches;
}

export const graphicsProfiles = {
  high: { density: 2, paintInterval: 0 },
  medium: { density: 1.35, paintInterval: 0 },
  low: { density: 1, paintInterval: 1000 / 30 },
};

const levels = ['low', 'medium', 'high'];

export function createGraphicsBudget({ handheld = false, cores } = {}) {
  const initial = handheld ? (cores != null && cores <= 4 ? 0 : 1) : 2;
  let level = initial;
  let last;
  let elapsed = 0;
  let frames = 0;
  let stable = 0;
  return {
    get level() { return levels[level]; },
    reset() { last = undefined; elapsed = 0; frames = 0; stable = 0; },
    sample(now) {
      const interval = now - last;
      last = now;
      if (!Number.isFinite(interval) || interval <= 0 || interval > 250) {
        elapsed = 0; frames = 0; stable = 0;
        return false;
      }
      elapsed += interval;
      frames++;
      if (elapsed < 1300) return false;
      const fps = frames * 1000 / elapsed;
      elapsed = 0; frames = 0;
      const previous = level;
      if (fps < 44) { level = Math.max(0, level - 1); stable = 0; }
      else if (fps >= 57 && level < (handheld ? 1 : 2)) {
        if (++stable >= 5) { level++; stable = 0; }
      } else stable = 0;
      return level !== previous;
    },
  };
}

export function selfieConstraints(handheld) {
  return { audio: false, video: { facingMode: { ideal: 'user' }, width: { ideal: handheld ? 480 : 640 }, height: { ideal: handheld ? 360 : 480 }, frameRate: { ideal: 30, max: 30 } } };
}

export function createTrackingBudget(handheld) {
  let next = 0;
  let average = 0;
  return {
    get maxEdge() { return average > 25 ? 384 : handheld ? 480 : 640; },
    reset() { next = 0; },
    canSample(now) { return now + 1 >= next; },
    measured(now, cost) {
      average = average ? average * .85 + cost * .15 : cost;
      const interval = Math.max(1000 / 30, Math.min(55, average * 1.55));
      next = Math.max(next + interval, now + interval / 2);
    },
  };
}
