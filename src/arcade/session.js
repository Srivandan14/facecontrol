export function createSession(makeWorld, random) {
  return { phase: 'ready', mode: 'manual', face: false, reason: '', countdown: 3, world: makeWorld(random), random };
}

export function isActive(session) {
  return session.phase === 'running' || session.phase === 'countdown';
}

export function pause(session, reason = 'manual') {
  if (!isActive(session)) return false;
  session.phase = 'paused';
  session.reason = reason;
  return true;
}

export function selectMode(session, mode) {
  if (session.mode === mode) return;
  pause(session);
  session.mode = mode;
  session.face = false;
}

export function start(session, restart, makeWorld) {
  if (session.mode === 'camera' && !session.face) return false;
  if (!restart && session.phase !== 'ready' && session.phase !== 'paused') return false;
  if (restart) session.world = makeWorld(session.random);
  session.phase = 'countdown';
  session.countdown = 3;
  session.reason = '';
  return true;
}

export function canAct(session) {
  return session.phase === 'running' && (session.mode === 'manual' || session.face);
}

export function observeFace(session, face) {
  if (session.mode !== 'camera') return false;
  session.face = face;
  if (!face) pause(session, 'face');
  return face;
}

export function advance(session, seconds, advanceWorld) {
  if (session.phase === 'countdown') {
    const consumed = Math.min(session.countdown, seconds);
    session.countdown = Math.max(0, session.countdown - consumed);
    seconds -= consumed;
    if (session.countdown > 1e-9) return;
    session.phase = 'running';
  }
  if (session.phase !== 'running') return;
  advanceWorld(session.world, seconds);
  if (session.world.collided) session.phase = 'over';
}
