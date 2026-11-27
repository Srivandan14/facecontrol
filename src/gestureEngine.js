export const gestures = [
  { id: 'blink', label: 'Blink', prompt: 'Blink both eyes firmly two or three times.' },
  { id: 'tiltLeft', label: 'Tilt left', prompt: 'Tip your left ear toward your left shoulder and hold.' },
  { id: 'tiltRight', label: 'Tilt right', prompt: 'Tip your right ear toward your right shoulder and hold.' },
  { id: 'mouth', label: 'Open mouth', prompt: 'Open your mouth comfortably and hold.' },
  { id: 'smile', label: 'Smile', prompt: 'Smile naturally and hold.' },
];

export const defaultSensitivity = 50;
const defaultNeutral = { blink: 0, roll: 0, mouth: 0, smile: 0 };
const defaultThresholds = { blink: .42, tiltLeft: 10, tiltRight: 10, mouth: .24, smile: .36 };
const minimumRange = { blink: .24, tiltLeft: 6, tiltRight: 6, mouth: .13, smile: .16 };
const defaultProfile = { neutral: defaultNeutral, thresholds: defaultThresholds };

export function readFaceSignals(result, width, height) {
  const landmarks = result.faceLandmarks?.[0];
  const categories = result.faceBlendshapes?.[0]?.categories;
  if (!landmarks?.[33] || !landmarks[263] || !categories || !width || !height) return null;

  const scores = Object.fromEntries(categories.map(({ categoryName, score }) => [categoryName, score]));
  const [left, right] = [landmarks[33], landmarks[263]];
  // In the raw camera image, the user's left eye is on the right side.
  const roll = Math.atan2((right.y - left.y) * height, (right.x - left.x) * width) * 180 / Math.PI;
  const signals = {
    roll,
    blink: Math.min(scores.eyeBlinkLeft, scores.eyeBlinkRight),
    mouth: scores.jawOpen,
    smile: (scores.mouthSmileLeft + scores.mouthSmileRight) / 2,
  };
  return Object.values(signals).every(Number.isFinite) ? signals : null;
}

function movement(signals, neutral, id) {
  if (id === 'tiltLeft') return signals.roll - neutral.roll;
  if (id === 'tiltRight') return neutral.roll - signals.roll;
  return signals[id] - neutral[id];
}

function percentile(values, fraction) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.round((sorted.length - 1) * fraction)];
}

export const calibrationSteps = [
  { id: 'neutral', label: 'Neutral face', prompt: 'Look straight ahead with your eyes open and your face relaxed.', duration: 1400 },
  ...gestures.map(gesture => ({ ...gesture, duration: gesture.id === 'blink' ? 2700 : 1000 })),
];

export function measureCalibrationStep(id, samples, neutral) {
  if (samples.length < 5) return { error: 'Too few frames were captured. Try again with good lighting.' };

  if (id === 'neutral') {
    const value = Object.fromEntries(Object.keys(defaultNeutral).map(key => [key, percentile(samples.map(sample => sample[key]), .5)]));
    const rolls = samples.map(sample => sample.roll);
    if (value.blink > .28 || value.mouth > .22 || value.smile > .42 || Math.abs(value.roll) > 25 || percentile(rolls, .85) - percentile(rolls, .15) > 5) {
      return { error: 'Relax your face, open your eyes, and keep your head upright and still. Then capture again.' };
    }
    return { value };
  }

  const changes = samples.map(sample => movement(sample, neutral, id));
  const range = id === 'blink' ? Math.max(...changes) : percentile(changes, .65);
  if (range < minimumRange[id] || (id === 'blink' && percentile(changes, .25) > .2)) {
    return { error: 'The movement was too small or unclear. Follow the cue and capture again.' };
  }
  return { value: Math.max(minimumRange[id] * .75, range * (id === 'blink' ? .43 : .5)) };
}

const timing = {
  blink: { smooth: 17, debounce: 18, cooldown: 300 },
  tiltLeft: { smooth: 85, debounce: 100, cooldown: 200 },
  tiltRight: { smooth: 85, debounce: 100, cooldown: 200 },
  mouth: { smooth: 70, debounce: 80, cooldown: 280 },
  smile: { smooth: 85, debounce: 110, cooldown: 250 },
};

// Call update with one sample per video frame. `active` is the held/pulsed
// state, and `triggered` lists new activations on this frame for game inputs.
export function createGestureEngine({ blinkHold = 0, neutralTiltReset = false } = {}) {
  let filtered;
  let previousTime;
  let channels;
  let previousProfile;
  let previousSensitivity;
  let tiltArmed;
  let centeredSince;

  function reset() {
    filtered = null;
    previousTime = null;
    tiltArmed = false;
    centeredSince = null;
    channels = Object.fromEntries(gestures.map(({ id }) => [id, { armed: false, held: false, since: null, peak: 0, next: 0, pulse: 0 }]));
  }
  reset();

  function update(signals, now, profile = defaultProfile, sensitivity = defaultSensitivity) {
    const active = Object.fromEntries(gestures.map(({ id }) => [id, false]));
    const triggered = [];
    if (!signals) { reset(); return { active, triggered }; }
    if (profile !== previousProfile || sensitivity !== previousSensitivity || now - previousTime > 250) reset();
    previousProfile = profile;
    previousSensitivity = sensitivity;

    const elapsed = previousTime === null ? 0 : Math.max(0, now - previousTime);
    previousTime = now;
    filtered ??= { ...signals };
    for (const key of Object.keys(filtered)) {
      const timeConstant = timing[key === 'roll' ? 'tiltLeft' : key].smooth;
      filtered[key] += (signals[key] - filtered[key]) * (1 - Math.exp(-elapsed / timeConstant));
    }

    const factor = 1.45 - Math.min(100, Math.max(0, sensitivity)) * .009;
    if (neutralTiltReset) {
      const center = Math.min(profile.thresholds.tiltLeft, profile.thresholds.tiltRight) * factor * .5;
      if (Math.abs(filtered.roll - profile.neutral.roll) <= center && Math.abs(signals.roll - profile.neutral.roll) <= center) {
        centeredSince ??= now;
        if (now - centeredSince >= 55) tiltArmed = true;
      } else centeredSince = null;
    }

    for (const { id } of gestures) {
      const channel = channels[id];
      const needsCenter = neutralTiltReset && (id === 'tiltLeft' || id === 'tiltRight');
      const debounce = id === 'blink' ? Math.max(timing.blink.debounce, blinkHold) : timing[id].debounce;
      const threshold = profile.thresholds[id] * factor;
      const amount = movement(filtered, profile.neutral, id);
      if (amount <= threshold * .64) {
        // A quick, strong bilateral blink can fall between two camera frames.
        // In that case, accept it on reopening after the debounce interval.
        const closureTime = now - channel.since;
        if (id === 'blink' && !blinkHold && channel.since !== null && closureTime >= debounce && closureTime <= 200 && channel.peak >= threshold * 1.2 && now >= channel.next) {
          channel.pulse = now + 240;
          channel.next = now + timing.blink.cooldown;
          triggered.push(id);
        }
        channel.armed = true;
        channel.held = false;
        channel.since = null;
        channel.peak = 0;
      } else if ((!needsCenter || tiltArmed) && channel.armed && amount >= threshold) {
        channel.since ??= now;
        channel.peak = Math.max(channel.peak, amount);
        if (now - channel.since >= debounce && now >= channel.next) {
          channel.held = true;
          channel.armed = false;
          channel.next = now + timing[id].cooldown;
          channel.pulse = now + 240;
          channel.since = null;
          channel.peak = 0;
          if (needsCenter) tiltArmed = false;
          triggered.push(id);
        }
      } else if (channel.armed && (id !== 'blink' || blinkHold || now - channel.since > 120)) {
        channel.since = null;
        channel.peak = 0;
      }
      active[id] = id === 'blink' ? now < channel.pulse : channel.held;
    }
    return { active, triggered };
  }

  return { update, reset };
}
