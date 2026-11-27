export const gameDetails = {
  runner: { title: 'Blink Runner', route: 'blink-runner', targets: [130, 200, 270] },
  racer: { title: 'Face Racer', route: 'face-racer', targets: [180, 260, 340] },
  space: { title: 'SpaceFace', route: 'spaceface', targets: [230, 320, 420] },
};

export function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export function dailyChallenge(date = new Date()) {
  const day = date.toISOString().slice(0, 10);
  const seed = Number(day.replaceAll('-', ''));
  const daysSinceEpoch = Math.floor(Date.parse(`${day}T00:00:00Z`) / 86400000);
  const gameIds = Object.keys(gameDetails);
  const gameId = gameIds[((daysSinceEpoch % 3) + 3) % 3];
  const game = gameDetails[gameId];
  const target = game.targets[Math.floor(seededRandom(Math.imul(seed, 2654435761))() * game.targets.length)];
  return { id: day, gameId, title: game.title, route: game.route, target, seed };
}

export function challengeStatus(challenge, runs) {
  const attempts = runs.filter(run => run.completed !== false && run.gameId === challenge.gameId && run.challengeId === challenge.id);
  const best = attempts.reduce((score, run) => Math.max(score, run.score), 0);
  return { attempts: attempts.length, best, complete: best >= challenge.target };
}

export const achievements = [
  { id: 'first', title: 'First Run', description: 'Finish a run in any game.', earned: stats => stats.completed >= 1 },
  { id: 'trio', title: 'Arcade Tour', description: 'Finish a run in all three games.', earned: stats => Object.values(stats.games).every(game => game.completed > 0) },
  { id: 'five', title: 'Regular Player', description: 'Finish five runs.', earned: stats => stats.completed >= 5 },
  { id: 'time', title: 'Five-Minute Streak', description: 'Spend five minutes in active gameplay across any runs.', earned: stats => stats.seconds >= 300 },
  { id: 'daily', title: 'Daily Pilot', description: 'Beat a daily challenge target.', earned: stats => stats.dailyCompleted > 0 },
];

export function summarizeRuns(runs) {
  const stats = { played: 0, completed: 0, seconds: 0, hasUnknownTime: false, dailyCompleted: 0, games: Object.fromEntries(Object.keys(gameDetails).map(id => [id, { best: 0, completed: 0 }])) };
  const completedDays = new Set();
  for (const run of runs) {
    const game = Object.hasOwn(stats.games, run.gameId) ? stats.games[run.gameId] : null;
    if (!game) continue;
    stats.played++;
    if (run.seconds == null) stats.hasUnknownTime = true;
    else stats.seconds += run.seconds;
    if (run.completed === false) continue;
    stats.completed++;
    game.completed++;
    game.best = Math.max(game.best, run.score);
    if (run.challengeId) {
      const challenge = dailyChallenge(new Date(`${run.challengeId}T00:00:00Z`));
      if (challenge.gameId === run.gameId && run.score >= challenge.target) completedDays.add(run.challengeId);
    }
  }
  stats.dailyCompleted = completedDays.size;
  return stats;
}

export function formatPlaytime(seconds) {
  const whole = Math.floor(seconds);
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor(whole / 60) % 60;
  return hours ? `${hours}h ${minutes}m` : minutes ? `${minutes}m ${whole % 60}s` : `${whole}s`;
}
