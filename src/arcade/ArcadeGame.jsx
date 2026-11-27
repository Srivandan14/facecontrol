import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, Camera, Keyboard, Maximize, Minimize, Trophy } from 'lucide-react';
import { useFaceTracking } from '../useFaceTracking.js';
import { highScore, saveRun } from '../scores.js';
import { seededRandom } from '../progress.js';
import { downloadScoreCard } from '../scoreCard.js';
import { createArcadeAudio } from './audio.js';
import { createInputHolds } from './inputHolds.js';
import { watchGameBackground } from './background.js';
import { PreviewToggle } from '../PreviewToggle.jsx';
import { createGraphicsBudget, graphicsProfiles, handheldDevice } from '../performance.js';
import { isActive, pause, selectMode } from './session.js';
import './arcade.css';

const cameraLabels = { off: 'Off', permission: 'Waiting for permission', loading: 'Loading model', tracking: 'On', error: 'Off' };

function snapshot(game, session) {
  return {
    phase: session.phase, mode: session.mode, reason: session.reason,
    countdown: Math.ceil(session.countdown), score: game.score(session.world), ...game.stats(session.world),
  };
}

function GameOverlay({ game, view, result, canStart }) {
  if (view.phase === 'running') return null;
  if (view.phase === 'countdown') return <div className="arcade-overlay arcade-countdown" role="status"><span className="arcade-count-number" key={view.countdown}>{view.countdown}</span><span>Get ready</span></div>;
  if (view.phase === 'over') return <div className="arcade-overlay" role="status">
    {result?.record && <div className="arcade-record"><Trophy size={19} /> New high score</div>}
    <h2>Game over</h2><p>Final score <strong>{view.score.toLocaleString()}</strong></p>
    {result?.challenge && <p>{view.score >= result.challenge.target ? 'Daily target reached' : `Daily target: ${result.challenge.target.toLocaleString()}`}</p>}
    {result && !result.saved && <p>This browser couldn’t save your score.</p>}
  </div>;
  if (view.phase === 'paused') return <div className="arcade-overlay" role="status">
    <h2>Paused</h2>
    <p>{view.reason === 'face' && !canStart ? 'Move back into view or switch to keyboard and touch.' : 'Select Resume when you’re ready.'}</p>
  </div>;
  return <div className="arcade-overlay arcade-ready"><span className="eyebrow">{game.genre}</span><h2>{game.readyTitle}</h2><p>{view.mode === 'camera' ? game.cameraInstructions : game.manualInstructions}</p></div>;
}

function GameCamera({ game, tracking, mode, hasProfile, showMesh, setShowMesh, previewOpen, togglePreview, sensitivity, onSensitivityChange, enableCamera, useManual }) {
  const busy = tracking.phase === 'permission' || tracking.phase === 'loading';
  return <aside className="panel arcade-camera" aria-labelledby="arcade-camera-heading">
    <div className="arcade-side-heading"><h2 id="arcade-camera-heading">Webcam controls</h2><PreviewToggle open={previewOpen} toggle={togglePreview} id="arcade-preview" /></div>
    <div id="arcade-preview" className="camera-stage arcade-camera-stage" data-collapsed={!previewOpen} aria-hidden={!previewOpen}>
      <video ref={tracking.videoRef} autoPlay muted playsInline aria-label="Mirrored webcam preview" className="camera-video" hidden={!tracking.cameraOn} />
      <canvas ref={tracking.meshRef} aria-hidden="true" className="camera-mesh" hidden={!tracking.cameraOn || !showMesh || !previewOpen} />
      {!tracking.cameraOn && <div className="camera-standby"><Camera size={29} /><p>{busy ? 'Allow access in your browser.' : 'Camera is off'}</p></div>}
    </div>
    {busy && <p className="product-note" role="status">{tracking.phase === 'permission' ? 'Waiting for your browser’s camera permission.' : 'Loading the face tracker. Choose Use keyboard / touch to play right away.'}</p>}
    <dl className="camera-readouts arcade-readouts">
      <div><dt>Camera</dt><dd>{cameraLabels[tracking.phase]}</dd></div>
      <div><dt>Face</dt><dd>{tracking.phase === 'tracking' ? (tracking.face ? 'Detected' : 'Not detected') : '—'}</dd></div>
      <div><dt>Tracking FPS</dt><dd>{tracking.fps ?? '—'}</dd></div>
    </dl>
    {game.gestures.map(({ id, label, icon: Icon }) => <div className="arcade-gesture" key={id} data-active={Boolean(tracking.active[id])}><Icon size={17} aria-hidden="true" /><span>{label}</span><strong>{tracking.active[id] ? 'Detected' : tracking.face ? 'Ready' : '—'}</strong></div>)}
    {tracking.error && <p className="camera-error" role="alert">{tracking.error}</p>}
    <div className="arcade-camera-actions">
      {(!tracking.cameraOn && !busy) && <button className="button secondary" type="button" onClick={enableCamera}><Camera size={16} /> Enable camera</button>}
      {mode === 'camera' && <button className="button secondary" type="button" onClick={useManual}><Keyboard size={17} /> Use keyboard / touch</button>}
    </div>
    {previewOpen && <label className="mesh-toggle"><input type="checkbox" checked={showMesh} onChange={event => setShowMesh(event.target.checked)} /> Show mesh</label>}
    <div className="arcade-sensitivity">
      <label className="sensitivity-label" htmlFor="arcade-sensitivity">{game.sensitivityLabel} <output htmlFor="arcade-sensitivity">{sensitivity}%</output></label>
      <input className="sensitivity-slider" id="arcade-sensitivity" type="range" min="0" max="100" value={sensitivity} onChange={event => onSensitivityChange(Number(event.target.value))} />
    </div>
    <p className="arcade-calibration-note">{hasProfile ? 'Using your personal calibration' : 'Using default gesture thresholds'}</p>
    <a className="text-link" href="#calibration">Open Calibration</a>
  </aside>;
}

export function ArcadeGame({ game, profile, sensitivity, onSensitivityChange, reducedMotion, challenge }) {
  const [session] = useState(() => game.create(challenge ? seededRandom(challenge.seed) : undefined));
  const [audio] = useState(createArcadeAudio);
  const [view, setView] = useState(() => snapshot(game, session));
  const [best, setBest] = useState(() => highScore(game.id));
  const [result, setResult] = useState(null);
  const [showMesh, setShowMesh] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(() => !handheldDevice() && !window.matchMedia('(max-width: 680px)').matches);
  const [sound, setSound] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [actionError, setActionError] = useState('');
  const [systemMotion, setSystemMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [graphics] = useState(() => createGraphicsBudget({ handheld: handheldDevice(), cores: navigator.hardwareConcurrency }));
  const [quality, setQuality] = useState(graphics.level);
  const canvasRef = useRef(null);
  const stageRef = useRef(null);
  const panelRef = useRef(null);
  const presented = useRef(view);
  const savedWorld = useRef(null);
  const bestRef = useRef(best);
  const motionRef = useRef(reducedMotion || systemMotion);
  const [holds] = useState(() => createInputHolds((input, pressed) => game.hold?.(session, input, pressed)));

  function sync() {
    const next = snapshot(game, session);
    if (Object.keys(next).every(key => next[key] === presented.current[key])) return;
    presented.current = next;
    setView(next);
  }

  function recordRun(completed) {
    const world = session.world;
    if (savedWorld.current === world || world.seconds <= 0) return null;
    savedWorld.current = world;
    const run = { gameId: game.id, score: game.score(world), seconds: world.seconds, completed, challengeId: challenge?.id };
    return { ...saveRun(run), run, challenge };
  }

  function paint() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!context) return;
    const scale = Math.min(canvas.width / game.arena.width, canvas.height / game.arena.height);
    context.setTransform(scale, 0, 0, scale, (canvas.width - game.arena.width * scale) / 2, (canvas.height - game.arena.height * scale) / 2);
    game.draw(context, session.world, motionRef.current || graphics.level === 'low');
  }

  function playInput(action) {
    if (action) audio.play(typeof action === 'string' ? action : game.inputSound);
  }

  function onTrackingSample(signals, _now, { triggered, active }) {
    const phase = session.phase;
    playInput(game.track(session, Boolean(signals), triggered, active));
    if (phase !== session.phase) sync();
  }

  const tracking = useFaceTracking({ showMesh: showMesh && previewOpen, profile, sensitivity, onSample: onTrackingSample, ...game.gestureOptions });
  const canStart = view.mode === 'manual' || tracking.face;
  const loopActive = view.phase === 'running' || view.phase === 'countdown';

  function updateHold(source, input, pressed) {
    if (!pressed) holds.release(source);
    else if (session.phase === 'running') holds.press(source, input);
  }

  const clearHolds = holds.clear;

  useLayoutEffect(() => {
    if (view.phase !== 'running') clearHolds();
  }, [view.phase]);

  useLayoutEffect(() => {
    if (tracking.phase === 'tracking') return;
    const phase = session.phase;
    game.track(session, false);
    if (phase !== session.phase) sync();
  }, [tracking.phase]);

  useLayoutEffect(() => {
    motionRef.current = reducedMotion || systemMotion;
    paint();
  }, [reducedMotion, systemMotion]);

  function resizeCanvas() {
    const canvas = canvasRef.current;
    const { width, height } = canvas.getBoundingClientRect();
    const density = Math.min(window.devicePixelRatio || 1, graphicsProfiles[graphics.level].density);
    const pixelsWide = Math.max(1, Math.round(width * density));
    const pixelsHigh = Math.max(1, Math.round(height * density));
    if (canvas.width !== pixelsWide) canvas.width = pixelsWide;
    if (canvas.height !== pixelsHigh) canvas.height = pixelsHigh;
    paint();
  }

  useLayoutEffect(() => {
    const observer = new ResizeObserver(resizeCanvas);
    observer.observe(canvasRef.current);
    resizeCanvas();
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    if (!loopActive) return;
    let animation;
    let previousTime = null;
    let lastCue = session.world.cue;
    let lastPaint = -Infinity;
    graphics.reset();
    function frame(now) {
      if (!isActive(session) || document.hidden) return;
      const elapsed = previousTime === null ? 0 : Math.min((now - previousTime) / 1000, .05);
      previousTime = now;
      const timeBefore = session.world.seconds;
      game.advance(session, elapsed);
      if (session.phase === 'running' && graphics.sample(now)) {
        setQuality(graphics.level);
        resizeCanvas();
        lastPaint = now;
      } else if (timeBefore !== session.world.seconds && (session.phase === 'over' || now - lastPaint >= graphicsProfiles[graphics.level].paintInterval - 1)) {
        paint();
        lastPaint = now;
      }
      if (session.phase === 'over') {
        const entry = recordRun(true);
        if (!entry) return;
        const record = entry.record && entry.run.score > bestRef.current;
        bestRef.current = Math.max(bestRef.current, entry.high);
        setBest(bestRef.current);
        setResult({ ...entry, record });
        audio.play(record ? 'record' : 'crash');
      } else if (session.world.cue && session.world.cue !== lastCue) audio.play(session.world.cue.type);
      lastCue = session.world.cue;
      sync();
      if (isActive(session)) animation = requestAnimationFrame(frame);
    }
    animation = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(animation);
  }, [loopActive]);

  function act(input) {
    playInput(game.input(session, input));
  }

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const changeMotion = event => setSystemMotion(event.matches);
    function onKey(event) {
      if (session.phase !== 'running' || event.altKey || event.ctrlKey || event.metaKey) return;
      const focused = event.target.closest?.('button, a, input, textarea, select, [contenteditable]');
      const holdButton = focused?.dataset?.arcadeHold;
      if (focused && !holdButton) return;
      const key = event.code === 'Space' ? ' ' : event.key.toLowerCase();
      const control = holdButton && (key === ' ' || key === 'enter') ? game.controls.find(candidate => candidate.input === holdButton) : game.controls.find(candidate => candidate.keys.includes(key));
      if (!control) return;
      event.preventDefault();
      if (event.repeat) return;
      if (control.hold) updateHold(`key:${event.code || event.key}`, control.input, true);
      else act(control.input);
    }
    function onKeyUp(event) {
      updateHold(`key:${event.code || event.key}`, null, false);
    }
    function pauseOnHide() {
      clearHolds();
      if (pause(session)) sync();
    }
    const stopWatchingBackground = watchGameBackground(document, window, pauseOnHide);
    const onPointerEnd = event => updateHold(`pointer:${event.pointerId}`, null, false);
    preference.addEventListener('change', changeMotion);
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', clearHolds);
    window.addEventListener('pointerup', onPointerEnd);
    window.addEventListener('pointercancel', onPointerEnd);
    const syncFullscreen = () => setFullscreen(document.fullscreenElement === panelRef.current);
    document.addEventListener('fullscreenchange', syncFullscreen);
    const finishOnUnload = event => { if (!event.persisted) recordRun(false); };
    window.addEventListener('pagehide', finishOnUnload);
    return () => {
      preference.removeEventListener('change', changeMotion);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clearHolds);
      window.removeEventListener('pointerup', onPointerEnd);
      window.removeEventListener('pointercancel', onPointerEnd);
      stopWatchingBackground();
      document.removeEventListener('fullscreenchange', syncFullscreen);
      window.removeEventListener('pagehide', finishOnUnload);
      recordRun(false);
      clearHolds();
      audio.close();
    };
  }, []);

  function begin(restart = false) {
    if (restart && (session.mode === 'manual' || session.face)) {
      recordRun(false);
      if (challenge) session.random = seededRandom(challenge.seed);
    }
    if (!game.start(session, restart)) return;
    clearHolds();
    audio.setEnabled(sound);
    setResult(null);
    setActionError('');
    paint();
    sync();
    stageRef.current.focus({ preventScroll: true });
  }

  function enableCamera() {
    selectMode(session, 'camera');
    sync();
    tracking.start();
  }

  function useManual() {
    selectMode(session, 'manual');
    tracking.stop();
    sync();
  }

  async function toggleFullscreen() {
    setActionError('');
    try {
      if (document.fullscreenElement === panelRef.current) await document.exitFullscreen();
      else await panelRef.current.requestFullscreen();
      stageRef.current?.focus({ preventScroll: true });
    } catch { setActionError('Fullscreen isn’t available in this browser window. You can keep playing here.'); }
  }

  function downloadResult() {
    setActionError('');
    try { downloadScoreCard(result.run); }
    catch { setActionError('The score card could not be downloaded. Your score is still shown above.'); }
  }

  const ModeIcon = view.mode === 'camera' ? game.modeIcon : Keyboard;
  return <div className={`arcade-layout arcade-${game.id}`}>
    <section ref={panelRef} className="panel arcade-main" aria-label={`${game.title} game`}>
      {challenge && <p className="arcade-challenge"><strong>Daily challenge</strong> {challenge.id} UTC · Target {challenge.target.toLocaleString()}</p>}
      <div className="arcade-hud">
        <div><span>Score</span><strong>{view.score.toLocaleString()}</strong></div>
        <div><span>High score</span><strong>{best.toLocaleString()}</strong></div>
        {game.readouts.map(({ id, label, format }) => <div key={id}><span>{label}</span><strong>{format ? format(view[id]) : view[id].toLocaleString()}</strong></div>)}
        <span className="arcade-mode"><ModeIcon size={15} /> {view.mode === 'camera' ? game.cameraMode : 'Keyboard / touch'}</span>
      </div>
      <div ref={stageRef} className="arcade-stage" tabIndex={0} role="region" aria-label={game.stageLabel}>
        <canvas ref={canvasRef} aria-hidden="true" />
        <GameOverlay game={game} view={view} result={result} canStart={canStart} />
      </div>
      <div className="arcade-actions">
        {view.phase === 'ready' && <button className="button primary" type="button" onClick={() => begin()} disabled={!canStart}>Start</button>}
        {loopActive && <button className="button secondary" type="button" onClick={() => { pause(session); sync(); }}>Pause</button>}
        {view.phase === 'paused' && <button className="button primary" type="button" onClick={() => begin()} disabled={!canStart}>Resume</button>}
        {view.phase !== 'ready' && <button className={view.phase === 'over' ? 'button primary' : 'button secondary'} type="button" onClick={() => begin(true)} disabled={!canStart}>Restart</button>}
        <a className="button secondary" href="#games"><ArrowLeft size={16} /> Exit</a>
        {typeof document !== 'undefined' && document.fullscreenEnabled && <button className="button secondary" type="button" onClick={toggleFullscreen} aria-pressed={fullscreen}>{fullscreen ? <Minimize size={16} /> : <Maximize size={16} />} {fullscreen ? 'Exit fullscreen' : 'Fullscreen'}</button>}
        {result && <button className="button secondary" type="button" onClick={downloadResult}>Download score card</button>}
        <div className="arcade-inputs">{game.controls.map(({ label, shortcut, icon: Icon, input, hold, available }) => <button key={label} className="button secondary arcade-input" type="button" disabled={view.phase !== 'running' || Boolean(available && !available(view))} data-arcade-hold={hold ? input : undefined}
          onClick={hold ? undefined : () => act(input)}
          onPointerDown={hold ? event => {
            if (event.pointerType === 'mouse' && event.button !== 0) return;
            event.preventDefault();
            try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* Global pointer release still applies. */ }
            updateHold(`pointer:${event.pointerId}`, input, true);
          } : undefined}
          onContextMenu={hold ? event => event.preventDefault() : undefined}
          onPointerUp={hold ? event => updateHold(`pointer:${event.pointerId}`, input, false) : undefined}
          onPointerCancel={hold ? event => updateHold(`pointer:${event.pointerId}`, input, false) : undefined}
          onLostPointerCapture={hold ? event => updateHold(`pointer:${event.pointerId}`, input, false) : undefined}
        ><Icon size={18} /> {label} <kbd>{shortcut}</kbd></button>)}</div>
      </div>
      {actionError && <p className="camera-error" role="status">{actionError}</p>}
      <div className="arcade-options">
        <p>{view.mode === 'camera' ? game.cameraInstructions : game.manualInstructions}</p>
        <label className="mesh-toggle"><input type="checkbox" checked={sound} onChange={event => { setSound(event.target.checked); audio.setEnabled(event.target.checked); }} /> Sound effects</label>
        <span className="arcade-quality">Graphics: {quality} (auto)</span>
      </div>
    </section>
    <GameCamera game={game} tracking={tracking} mode={view.mode} hasProfile={Boolean(profile)} showMesh={showMesh} setShowMesh={setShowMesh} previewOpen={previewOpen} togglePreview={() => setPreviewOpen(open => !open)} sensitivity={sensitivity} onSensitivityChange={onSensitivityChange} enableCamera={enableCamera} useManual={useManual} />
  </div>;
}
