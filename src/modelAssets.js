export const modelFile = 'models/face_landmarker.task';
export const modelDownloadUrl = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

// MediaPipe task bundles are ZIP archives. Check both ends to catch HTML,
// truncated downloads, and similarly named files before loading WebAssembly.
export function isModelBundle(bytes) {
  if (bytes.length < 1_000_000 || bytes.length > 32_000_000) return false;
  const matches = (index, a, b) => bytes[index] === 0x50 && bytes[index + 1] === 0x4b && bytes[index + 2] === a && bytes[index + 3] === b;
  let header = false;
  for (let index = 0; index < 24; index++) {
    if (matches(index, 3, 4)) { header = true; break; }
  }
  if (!header) return false;
  for (let index = bytes.length - 22; index >= Math.max(0, bytes.length - 65557); index--) {
    if (matches(index, 5, 6) && index + 22 + (bytes[index + 20] | bytes[index + 21] << 8) === bytes.length) return true;
  }
  return false;
}

async function readModel(url, signal, fetchAsset) {
  const response = await fetchAsset(url, { signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
  if (!response.ok) throw new Error(`Model request returned HTTP ${response.status}.`);
  if (response.headers.get('content-type')?.includes('text/html')) throw new Error('Expected a MediaPipe model, received an HTML page.');
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!isModelBundle(bytes)) throw new Error('The MediaPipe model is incomplete or invalid.');
  return bytes;
}

export async function loadModelBytes(localUrl, signal, fetchAsset = fetch) {
  // Older iOS Safari releases lack AbortSignal.any() and AbortSignal.timeout().
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal.aborted) controller.abort();
  else signal.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, 30000);
  try {
    try { return await readModel(localUrl, controller.signal, fetchAsset); }
    catch (error) {
      if (controller.signal.aborted) throw error;
      return await readModel(modelDownloadUrl, controller.signal, fetchAsset);
    }
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', abort);
  }
}
