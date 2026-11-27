import React from 'react';
import { ArrowUp, Eye } from 'lucide-react';
import { ArcadeGame } from '../arcade/ArcadeGame.jsx';
import { acceptTrackingFrame, advanceRunner, arena, createRunner, runnerJump, scoreFor, startRunner } from './engine.js';
import { drawRun } from './render.js';

const game = {
  id: 'runner', title: 'Blink Runner', genre: 'ENDLESS RUNNER', arena,
  create: createRunner, start: startRunner, advance: advanceRunner, input: runnerJump,
  track: acceptTrackingFrame, draw: drawRun, score: scoreFor,
  stats: world => ({ cleared: world.cleared }),
  readouts: [{ id: 'cleared', label: 'Cleared' }],
  modeIcon: Eye, cameraMode: 'Blink control', readyTitle: 'Clear the barriers', inputSound: 'jump',
  stageLabel: 'Game arena. Press Space to jump.',
  cameraInstructions: 'Close both eyes briefly, then reopen. Space and Jump also work while your face is detected.',
  manualInstructions: 'Use Space or Jump, or enable the camera to play with blinks.',
  controls: [{ keys: [' '], label: 'Jump', shortcut: 'Space', icon: ArrowUp }],
  gestures: [{ id: 'blink', label: 'Deliberate blink', icon: Eye }],
  gestureOptions: { blinkHold: 115 },
  sensitivityLabel: 'Blink sensitivity',
};

export function BlinkRunner(props) {
  return <ArcadeGame {...props} game={game} />;
}
