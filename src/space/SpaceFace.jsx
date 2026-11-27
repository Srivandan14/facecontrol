import React from 'react';
import { ArrowLeft, ArrowRight, MoveHorizontal, ScanFace, Smile, Sparkles, Zap } from 'lucide-react';
import { ArcadeGame } from '../arcade/ArcadeGame.jsx';
import { advanceSpace, arena, createSpace, energyCapacity, maximumLives, scoreFor, shieldTime, startSpace } from './engine.js';
import { acceptSpaceTracking, holdSpaceInput, spaceInput } from './controls.js';
import { drawFlight } from './render.js';

function Lives({ count }) {
  return <span className="space-lives" role="img" aria-label={`${count} of ${maximumLives} lives`}>
    {Array.from({ length: maximumLives }, (_, index) => <span key={index} aria-hidden="true" data-full={index < count}>♥</span>)}
  </span>;
}

function Energy({ amount }) {
  return <span className="space-energy" data-ready={amount === energyCapacity}>
    <meter min={0} max={energyCapacity} value={amount} aria-label="Blast energy" />
    <span>{amount === energyCapacity ? 'Ready' : `${amount}%`}</span>
  </span>;
}

const game = {
  id: 'space', title: 'SpaceFace', genre: 'ENDLESS SPACE SURVIVAL', arena,
  create: createSpace, start: startSpace, advance: advanceSpace, input: spaceInput, hold: holdSpaceInput,
  track: acceptSpaceTracking, draw: drawFlight, score: scoreFor,
  stats: world => ({ lives: world.lives, energy: world.energy, wave: world.wave, shield: Math.ceil(shieldTime(world)) }),
  readouts: [
    { id: 'lives', label: 'Lives', format: count => <Lives count={count} /> },
    { id: 'energy', label: 'Blast energy', format: amount => <Energy amount={amount} /> },
    { id: 'wave', label: 'Wave' }, { id: 'shield', label: 'Shield', format: seconds => seconds ? `${seconds}s` : '—' },
  ],
  modeIcon: ScanFace, cameraMode: 'Gesture control', readyTitle: 'Survive the asteroid field',
  stageLabel: 'Space arena. Hold arrows or A and D to steer, Space to fire, and press E for the blast.',
  cameraInstructions: 'Hold a head tilt to steer, open your mouth to fire, and smile when Blast energy is ready.',
  manualInstructions: 'Hold ←/→ or A/D to steer and Space to fire. Press E when Blast energy is ready.',
  controls: [
    { input: 'left', keys: ['arrowleft', 'a'], label: 'Left', shortcut: 'A', icon: ArrowLeft, hold: true },
    { input: 'right', keys: ['arrowright', 'd'], label: 'Right', shortcut: 'D', icon: ArrowRight, hold: true },
    { input: 'fire', keys: [' '], label: 'Fire', shortcut: 'Space', icon: Zap, hold: true },
    { input: 'blast', keys: ['e'], label: 'Blast', shortcut: 'E', icon: Sparkles, available: view => view.energy === energyCapacity },
  ],
  gestures: [
    { id: 'tiltLeft', label: 'Tilt left', icon: MoveHorizontal },
    { id: 'tiltRight', label: 'Tilt right', icon: MoveHorizontal },
    { id: 'mouth', label: 'Mouth open', icon: Zap },
    { id: 'smile', label: 'Smile', icon: Smile },
  ],
  sensitivityLabel: 'SpaceFace sensitivity',
};

export function SpaceFace(props) {
  return <ArcadeGame {...props} game={game} />;
}
