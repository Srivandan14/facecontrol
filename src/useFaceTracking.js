import { useLayoutEffect, useRef, useState } from 'react';
import { createGestureEngine, readFaceSignals } from './gestureEngine.js';
import { releaseCameraSession, stopTracks } from './cameraSession.js';
import { createTrackingBudget, handheldDevice, selfieConstraints } from './performance.js';

const idle = { phase: 'off', cameraOn: false, face: false, fps: null, active: {}, error: '' };

function cameraError(error) {
  switch (error?.name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
    case 'SecurityError': return 'Camera permission was denied. Allow camera access in your browser’s site settings, then try again.';
    case 'NotFoundError':
    case 'DevicesNotFoundError': return 'No webcam was found. Connect or enable a webcam, then try again.';
    case 'NotReadableError':
    case 'TrackStartError': return 'Your webcam could not start. Close other apps using it, then try again.';
    default: return 'Could not start the webcam. Check your camera and device privacy settings, then try again.';
  }
}

function drawMesh(canvas, landmarks, connections, width, height) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  ctx.clearRect(0, 0, width, height);
  if (!landmarks) return;
  ctx.strokeStyle = 'rgba(104, 236, 240, .64)';
  ctx.lineWidth = Math.max(0.65, width / 850);
  ctx.beginPath();
  for (const { start, end } of connections) {
    const a = landmarks[start];
    const b = landmarks[end];
    if (!a || !b) continue;
    ctx.moveTo(a.x * width, a.y * height);
    ctx.lineTo(b.x * width, b.y * height);
  }
  ctx.stroke();
}

function detectionInput(video, buffer, maxEdge) {
  const scale = maxEdge / Math.max(video.videoWidth, video.videoHeight);
  if (scale >= 1 || !buffer.context) return video;
  const width = Math.max(1, Math.round(video.videoWidth * scale));
  const height = Math.max(1, Math.round(video.videoHeight * scale));
  if (buffer.canvas.width !== width) buffer.canvas.width = width;
  if (buffer.canvas.height !== height) buffer.canvas.height = height;
  buffer.context.drawImage(video, 0, 0, width, height);
  return buffer.canvas;
}

export function useFaceTracking({ showMesh, profile, sensitivity, onSample, blinkHold, neutralTiltReset }) {
  const [tracking, setTracking] = useState(idle);
  const videoRef = useRef(null);
  const meshRef = useRef(null);
  const sessionRef = useRef(null);
  const optionsRef = useRef({ showMesh, profile, sensitivity, onSample });

  useLayoutEffect(() => {
    optionsRef.current = { showMesh, profile, sensitivity, onSample };
  }, [showMesh, profile, sensitivity, onSample]);

  useLayoutEffect(() => {
    if (showMesh || !sessionRef.current) return;
    const canvas = meshRef.current;
    canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
  }, [showMesh]);

  function closeSession() {
    const session = sessionRef.current;
    sessionRef.current = null;
    if (session) releaseCameraSession(session);
  }

  function stop() {
    closeSession();
    setTracking(idle);
  }

  useLayoutEffect(() => {
    window.addEventListener('pagehide', stop);
    return () => {
      window.removeEventListener('pagehide', stop);
      closeSession();
    };
  }, []);

  async function start() {
    if (sessionRef.current) return;
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setTracking({ ...idle, phase: 'error', error: 'Webcam access requires a supported browser and a secure page. Open FaceControl at localhost or HTTPS.' });
      return;
    }

    const session = { abort: new AbortController(), video: videoRef.current, canvas: meshRef.current };
    const handheld = handheldDevice();
    sessionRef.current = session;
    const isCurrent = () => sessionRef.current === session;

    function fail(message) {
      if (!isCurrent()) return;
      closeSession();
      setTracking({ ...idle, phase: 'error', error: message });
    }

    setTracking({ ...idle, phase: 'permission' });
    try {
      const stream = await navigator.mediaDevices.getUserMedia(selfieConstraints(handheld));
      if (!isCurrent()) { stopTracks(stream); return; }
      session.stream = stream;
      [session.track] = stream.getVideoTracks();
      session.ended = () => fail('The webcam disconnected or stopped. Reconnect or enable it, then try again.');
      session.track.addEventListener('ended', session.ended);
      session.video.srcObject = stream;
      setTracking({ ...idle, phase: 'loading', cameraOn: true });
      await session.video.play();
    } catch (error) {
      fail(cameraError(error));
      return;
    }
    if (!isCurrent()) return;
    let mesh;
    try {
      const { createFaceLandmarker } = await import('./faceLandmarker.js');
      const model = await createFaceLandmarker(session.abort.signal);
      if (!isCurrent()) { model.detector.close(); return; }
      session.detector = model.detector;
      mesh = model.mesh;
    } catch {
      fail('The face tracking model could not load. Check your connection and try again. If Google’s model download is blocked, use a local copy of the model.');
      return;
    }

    const engine = createGestureEngine({ blinkHold, neutralTiltReset });
    const budget = createTrackingBudget(handheld);
    const inputCanvas = document.createElement('canvas');
    const buffer = { canvas: inputCanvas, context: inputCanvas.getContext('2d', { alpha: false }) };
    const frameTimes = [];
    let lastPaint = performance.now();
    let previousMediaTime = -1;
    let lastFrame = lastPaint;
    let lastFps = null;
    let lastPublished = { ...idle, phase: 'tracking', cameraOn: true };
    setTracking(lastPublished);

    function publish(now, signals) {
      const options = optionsRef.current;
      const { active, triggered } = engine.update(signals, now, options.profile ?? undefined, options.sensitivity);
      options.onSample?.(signals, now, { active, triggered });
      const face = Boolean(signals);
      if (face === lastPublished.face && lastFps === lastPublished.fps && Object.keys(active).every(id => Boolean(lastPublished.active[id]) === active[id])) return;
      lastPublished = { ...lastPublished, face, fps: lastFps, active };
      setTracking(lastPublished);
    }

    function frame(now) {
      if (!isCurrent() || document.hidden) return;
      const { video, canvas, detector } = session;
      const width = video.videoWidth;
      const height = video.videoHeight;
      try {
        if (video.readyState >= 2 && width && height && video.currentTime !== previousMediaTime && budget.canSample(now)) {
          previousMediaTime = video.currentTime;
          lastFrame = now;
          const startedAt = performance.now();
          const input = detectionInput(video, buffer, budget.maxEdge);
          const result = detector.detectForVideo(input, now);
          budget.measured(now, performance.now() - startedAt);
          const signals = readFaceSignals(result, width, height);
          frameTimes.push(now);
          while (frameTimes.length > 1 && now - frameTimes[0] > 1000) frameTimes.shift();
          if (now - lastPaint >= 300 && frameTimes.length > 1) {
            lastFps = Math.round((frameTimes.length - 1) * 1000 / (now - frameTimes[0]));
            lastPaint = now;
          }
          if (optionsRef.current.showMesh) drawMesh(canvas, result.faceLandmarks?.[0], mesh, width, height);
          publish(now, signals);
        } else if (now - lastFrame > 600 && lastFps !== 0) {
          frameTimes.length = 0;
          lastFps = 0;
          if (optionsRef.current.showMesh && width && height) drawMesh(canvas, null, mesh, width, height);
          publish(now, null);
        }
      } catch {
        fail('Face tracking stopped unexpectedly. Start the camera again to retry.');
        return;
      }
      session.frame = requestAnimationFrame(frame);
    }
    const onVisibility = () => {
      cancelAnimationFrame(session.frame);
      session.frame = undefined;
      if (document.hidden) {
        frameTimes.length = 0;
        lastFps = null;
        const { canvas } = session;
        canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
        buffer.context?.clearRect(0, 0, inputCanvas.width, inputCanvas.height);
        publish(performance.now(), null);
        return;
      }
      previousMediaTime = -1;
      lastFrame = performance.now();
      lastPaint = lastFrame;
      budget.reset();
      if (session.video.paused) session.video.play().catch(() => fail('The camera did not resume. Enable it again or switch to keyboard and touch.'));
      session.frame = requestAnimationFrame(frame);
    };
    document.addEventListener('visibilitychange', onVisibility);
    session.removeVisibility = () => document.removeEventListener('visibilitychange', onVisibility);
    onVisibility();
  }

  return { ...tracking, videoRef, meshRef, start, stop };
}
