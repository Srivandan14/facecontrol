const tones = {
  jump: [330, 760, .11], crash: [210, 75, .22], record: [420, 950, .30],
  lane: [240, 350, .08], coin: [730, 1270, .15], shield: [410, 615, .24],
  laser: [820, 340, .10], blast: [180, 720, .31], impact: [200, 95, .13],
  damage: [190, 85, .20], health: [510, 980, .20],
};

export function createArcadeAudio() {
  let audio;
  let enabled = false;

  return {
    setEnabled(value) {
      enabled = value;
      if (!enabled || typeof AudioContext === 'undefined') return;
      try {
        audio ??= new AudioContext();
        if (audio.state === 'suspended') audio.resume().catch(() => {});
      } catch { /* Gameplay continues if audio is unavailable. */ }
    },
    play(kind) {
      if (!enabled || audio?.state !== 'running' || !tones[kind]) return;
      const [from, to, duration] = tones[kind];
      const time = audio.currentTime;
      const oscillator = audio.createOscillator();
      const volume = audio.createGain();
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(from, time);
      oscillator.frequency.exponentialRampToValueAtTime(to, time + duration - .015);
      volume.gain.setValueAtTime(.001, time);
      volume.gain.linearRampToValueAtTime(.085, time + .015);
      volume.gain.exponentialRampToValueAtTime(.001, time + duration);
      oscillator.connect(volume).connect(audio.destination);
      oscillator.onended = () => { oscillator.disconnect(); volume.disconnect(); };
      oscillator.start(time);
      oscillator.stop(time + duration);
    },
    close() {
      if (audio && audio.state !== 'closed') audio.close().catch(() => {});
      audio = undefined;
      enabled = false;
    },
  };
}
