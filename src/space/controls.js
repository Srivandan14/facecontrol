import { canAct, observeFace } from '../arcade/session.js';
import { fireLaser, useBlast } from './engine.js';

export function acceptSpaceTracking(session, face, triggered = [], active = {}) {
  const controlling = observeFace(session, face) && canAct(session);
  // The calibrated engine already maps raw camera roll to the player's left and right.
  session.world.faceInput.direction = controlling ? Number(Boolean(active.tiltRight)) - Number(Boolean(active.tiltLeft)) : 0;
  session.world.faceInput.fire = controlling && Boolean(active.mouth);
  if (controlling && triggered.includes('smile') && useBlast(session.world)) return 'blast';
}

export function holdSpaceInput(session, action, pressed) {
  if (!Object.hasOwn(session.world.manual, action) || (pressed && !canAct(session))) return;
  if (pressed && action === 'fire' && !session.world.manual.fire) fireLaser(session.world);
  session.world.manual[action] = pressed;
}

export function spaceInput(session, action) {
  if (action === 'blast' && canAct(session) && useBlast(session.world)) return 'blast';
}
