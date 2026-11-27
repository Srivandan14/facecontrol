import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import wasmLoader from '../node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_internal.js?url';
import wasmBinary from '../node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_internal.wasm?url';
import fallbackLoader from '../node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_nosimd_internal.js?url';
import fallbackBinary from '../node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_nosimd_internal.wasm?url';
import { loadModelBytes, modelFile } from './modelAssets.js';

export async function createFaceLandmarker(signal) {
  const modelAssetBuffer = await loadModelBytes(`${import.meta.env.BASE_URL}${modelFile}`, signal);
  const simd = await FilesetResolver.isSimdSupported();
  if (signal.aborted) throw new DOMException('Camera startup was cancelled.', 'AbortError');
  const detector = await FaceLandmarker.createFromOptions({
    wasmLoaderPath: new URL(simd ? wasmLoader : fallbackLoader, document.baseURI).href,
    wasmBinaryPath: new URL(simd ? wasmBinary : fallbackBinary, document.baseURI).href,
  }, {
    baseOptions: { modelAssetBuffer },
    runningMode: 'VIDEO',
    numFaces: 1,
    outputFaceBlendshapes: true,
  });
  return { detector, mesh: FaceLandmarker.FACE_LANDMARKS_TESSELATION };
}
