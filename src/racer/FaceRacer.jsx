import React from 'react';
import { ArrowLeft, ArrowRight, MoveHorizontal, RotateCcw, RotateCw } from 'lucide-react';
import { ArcadeGame } from '../arcade/ArcadeGame.jsx';
import { acceptRaceTracking, advanceRace, arena, createRace, roadSpeed, scoreFor, shieldTime, startRace, steer } from './engine.js';
import { drawRace } from './render.js';

const game = {
  id: 'racer', title: 'Face Racer', genre: 'ENDLESS RACING', arena,
  create: createRace, start: startRace, advance: advanceRace, input: steer,
  track: acceptRaceTracking, draw: drawRace, score: scoreFor,
  stats: world => ({ speed: Math.round(roadSpeed(world.seconds) * .56), overtakes: world.overtakes, coins: world.coins, shield: Math.ceil(shieldTime(world)) }),
  readouts: [
    { id: 'speed', label: 'Speed', format: speed => `${speed} km/h` },
    { id: 'overtakes', label: 'Overtakes' }, { id: 'coins', label: 'Coins' },
    { id: 'shield', label: 'Shield', format: seconds => seconds ? `${seconds}s` : '—' },
  ],
  modeIcon: MoveHorizontal, cameraMode: 'Head tilt control', inputSound: 'lane',
  readyTitle: 'Find the open lane', stageLabel: 'Race track. Press the left or right arrow, or A or D, to steer.',
  cameraInstructions: 'Tip an ear toward the same shoulder, then return upright before your next lane change.',
  manualInstructions: 'Use the arrow keys, A and D, or the on-screen buttons to steer.',
  controls: [
    { input: -1, keys: ['arrowleft', 'a'], label: 'Left', shortcut: 'A', icon: ArrowLeft },
    { input: 1, keys: ['arrowright', 'd'], label: 'Right', shortcut: 'D', icon: ArrowRight },
  ],
  gestures: [
    { id: 'tiltLeft', label: 'Tilt left', icon: RotateCcw },
    { id: 'tiltRight', label: 'Tilt right', icon: RotateCw },
  ],
  gestureOptions: { neutralTiltReset: true },
  sensitivityLabel: 'Head-tilt sensitivity',
};

export function FaceRacer(props) {
  return <ArcadeGame {...props} game={game} />;
}
