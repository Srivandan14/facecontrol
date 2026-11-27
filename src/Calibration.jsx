import React, { useEffect, useRef, useState } from 'react';
import { Camera, Eye, RotateCcw, RotateCw, ScanFace, ShieldCheck, SlidersHorizontal, Smile, Square } from 'lucide-react';
import { calibrationSteps, gestures, measureCalibrationStep } from './gestureEngine.js';
import { useFaceTracking } from './useFaceTracking.js';
import { PreviewToggle } from './PreviewToggle.jsx';

const icons = { blink: Eye, tiltLeft: RotateCcw, tiltRight: RotateCw, mouth: ScanFace, smile: Smile };
const cameraStates = { off: 'Off', permission: 'Waiting for permission', loading: 'On · loading model', tracking: 'On', error: 'Off' };

function CameraPreview({ tracking, showMesh, onMeshChange, onStop, previewOpen, togglePreview }) {
  const { phase, cameraOn, face, fps, error, videoRef, meshRef, start } = tracking;
  const running = ['permission', 'loading', 'tracking'].includes(phase);
  const cameraMessage = {
    off: 'Start the camera to see your preview.',
    permission: 'Allow camera access in your browser.',
    loading: 'Loading the face tracking model…',
    tracking: face ? 'Face detected' : 'No face detected',
    error: 'Camera stopped',
  }[phase];

  return <section className="panel camera-panel" aria-labelledby="camera-heading">
    <div className="calibration-panel-heading">
      <div><h2 id="camera-heading">Webcam preview</h2><p>Face the camera in good light.</p></div>
      <div className="calibration-preview-controls"><PreviewToggle open={previewOpen} toggle={togglePreview} id="calibration-preview" />{previewOpen && <label className="mesh-toggle"><input type="checkbox" checked={showMesh} onChange={event => onMeshChange(event.target.checked)} /> Show mesh</label>}</div>
    </div>
    <div id="calibration-preview" className="camera-stage" data-collapsed={!previewOpen} aria-hidden={!previewOpen}>
      <video ref={videoRef} autoPlay muted playsInline aria-label="Mirrored webcam preview" className="camera-video" hidden={!cameraOn} />
      <canvas ref={meshRef} aria-hidden="true" className="camera-mesh" hidden={!cameraOn || !showMesh || !previewOpen} />
      {!cameraOn && <div className="camera-standby"><ScanFace size={52} strokeWidth={1.2} /><p>{cameraMessage}</p></div>}
      {cameraOn && <span className="camera-badge" data-detected={face} role="status"><span />{cameraMessage}</span>}
    </div>
    <dl className="camera-readouts">
      <div><dt>Camera</dt><dd>{cameraStates[phase]}</dd></div>
      <div><dt>Face</dt><dd>{phase === 'tracking' ? (face ? 'Detected' : 'Not detected') : '—'}</dd></div>
      <div><dt>Tracking FPS</dt><dd>{fps ?? '—'}</dd></div>
    </dl>
    {phase === 'tracking' && !face && <p className="camera-tip">Center your face and make sure your eyes and mouth are visible.</p>}
    {error && <p className="camera-error" role="alert">{error}</p>}
    <div className="camera-actions">
      <button className="button primary" type="button" onClick={start} disabled={running}><Camera size={17} /> Start Camera</button>
      <button className="button secondary" type="button" onClick={onStop} disabled={!running}><Square size={15} /> Stop Camera</button>
    </div>
  </section>;
}

function GestureIndicators({ active, face }) {
  return <section className="panel gesture-panel" aria-labelledby="gesture-heading">
    <div className="calibration-panel-heading"><div><h2 id="gesture-heading">Live gestures</h2><p>Each indicator lights up when the movement is detected.</p></div></div>
    <ul className="gesture-list">
      {gestures.map(({ id, label }) => {
        const Icon = icons[id];
        return <li key={id} data-active={Boolean(active[id])}><Icon size={18} aria-hidden="true" /><span>{label}</span><span className="gesture-state">{active[id] ? 'Detected' : face ? 'Ready' : '—'}</span></li>;
      })}
    </ul>
  </section>;
}

export function Calibration({ profile, onProfileChange, sensitivity, onSensitivityChange }) {
  const [showMesh, setShowMesh] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(true);
  const [stepIndex, setStepIndex] = useState(null);
  const [progress, setProgress] = useState(null);
  const [feedback, setFeedback] = useState('');
  const draft = useRef(null);
  const capture = useRef(null);
  const step = calibrationSteps[stepIndex];

  function finishCapture(message = '') {
    capture.current = null;
    setProgress(null);
    setFeedback(message);
  }

  function onSample(signals, now) {
    const current = capture.current;
    if (!current) return;
    if (!signals) {
      finishCapture('Face lost during capture. Move back into view, then try this step again.');
      return;
    }

    current.start ??= now;
    current.samples.push(signals);
    const elapsed = now - current.start;
    if (elapsed < current.step.duration) {
      setProgress(Math.floor(elapsed / current.step.duration * 20) * 5);
      return;
    }

    const { id } = current.step;
    const result = measureCalibrationStep(id, current.samples, draft.current.neutral);
    finishCapture(result.error);
    if (result.error) return;
    if (id === 'neutral') draft.current.neutral = result.value;
    else draft.current.thresholds[id] = result.value;

    if (current.index < calibrationSteps.length - 1) {
      setStepIndex(current.index + 1);
    } else {
      onProfileChange(draft.current);
      draft.current = null;
      setStepIndex(null);
      setFeedback('Calibration complete. Try each movement against the live indicators.');
    }
  }

  const tracking = useFaceTracking({ showMesh: showMesh && previewOpen, profile, sensitivity, onSample });

  useEffect(() => {
    if (tracking.phase !== 'tracking' && capture.current) {
      finishCapture('Capture stopped. Start the camera to try this step again.');
    }
  }, [tracking.phase]);

  function beginCalibration() {
    draft.current = { neutral: null, thresholds: {} };
    setStepIndex(0);
    setFeedback('');
  }

  function beginCapture() {
    if (capture.current || !tracking.face) return;
    capture.current = { index: stepIndex, step, start: null, samples: [] };
    setFeedback('');
    setProgress(0);
  }

  function cancelCalibration() {
    finishCapture();
    draft.current = null;
    setStepIndex(null);
  }

  return <div className="calibration-workspace">
    <div className="calibration-grid">
      <CameraPreview tracking={tracking} showMesh={showMesh} onMeshChange={setShowMesh} onStop={tracking.stop} previewOpen={previewOpen} togglePreview={() => setPreviewOpen(open => !open)} />
      <GestureIndicators active={tracking.active} face={tracking.face} />
    </div>
    <div className="calibration-grid calibration-controls">
      <section className="panel calibration-setup" aria-labelledby="setup-heading">
        <div className="calibration-panel-heading"><div><h2 id="setup-heading">Personal calibration</h2><p>{profile ? 'Using your personal thresholds.' : 'Using default thresholds until you calibrate.'}</p></div></div>
        {step ? <>
          <div className="calibration-cue"><span className="eyebrow">STEP {stepIndex + 1} OF {calibrationSteps.length}</span><h3>{step.label}</h3><p>{step.prompt}</p><p>{step.id === 'blink' ? 'Click Capture, then blink.' : 'Get into position before clicking Capture.'}</p></div>
          {progress !== null && <progress value={progress} max={100} aria-label={`Capturing ${step.label.toLowerCase()}`} />}
          <div className="camera-actions"><button type="button" className="button primary" disabled={!tracking.face || progress !== null} onClick={beginCapture}>{progress === null ? 'Capture' : 'Capturing…'}</button><button type="button" className="button secondary" onClick={cancelCalibration}>Cancel</button></div>
        </> : <div className="camera-actions"><button type="button" className="button primary" onClick={beginCalibration} disabled={!tracking.face}>{profile ? 'Recalibrate' : 'Start calibration'}</button></div>}
        {!tracking.face && <p className="camera-tip">A detected face is needed to capture each step.</p>}
        {feedback && <p className="calibration-feedback" role="status">{feedback}</p>}
      </section>
      <section className="panel calibration-setup" aria-labelledby="sensitivity-heading">
        <div className="calibration-panel-heading"><div><h2 id="sensitivity-heading">Gesture sensitivity</h2><p>Higher sensitivity detects smaller movements.</p></div><SlidersHorizontal size={20} aria-hidden="true" /></div>
        <label className="sensitivity-label" htmlFor="live-sensitivity">Sensitivity <output htmlFor="live-sensitivity">{sensitivity}%</output></label>
        <input id="live-sensitivity" className="sensitivity-slider" type="range" min="0" max="100" value={sensitivity} onChange={event => onSensitivityChange(Number(event.target.value))} />
        <div className="sensitivity-scale"><span>Lower</span><span>Higher</span></div>
      </section>
    </div>
    <div className="privacy-band"><div className="panel-icon"><ShieldCheck size={23} /></div><div><h2>Your camera feed stays on your device</h2><p>FaceControl processes frames in this browser. It never uploads or saves camera images.</p></div></div>
  </div>;
}
