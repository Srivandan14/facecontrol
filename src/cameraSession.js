export function stopTracks(stream) {
  stream?.getTracks().forEach(track => track.stop());
}

export function releaseCameraSession(session, cancelFrame = cancelAnimationFrame) {
  session.abort.abort();
  session.removeVisibility?.();
  if (session.frame != null) cancelFrame(session.frame);
  if (session.track && session.ended) session.track.removeEventListener('ended', session.ended);
  stopTracks(session.stream);
  session.video.pause();
  session.video.srcObject = null;
  const { width, height } = session.canvas;
  session.canvas.getContext('2d')?.clearRect(0, 0, width, height);
  // A detector error must not block page navigation after its stream has stopped.
  try { session.detector?.close(); } catch { /* The stopped session is no longer used. */ }
}
