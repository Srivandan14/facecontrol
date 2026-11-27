import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { setTimeout as wait } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { isModelBundle, modelDownloadUrl, modelFile } from '../src/modelAssets.js';

async function readIfPresent(path) {
  try { return await readFile(path); }
  catch (error) { if (error.code !== 'ENOENT') throw error; return null; }
}

async function main() {
  const checkingBuild = process.argv.includes('--check-build');
  const folder = checkingBuild ? 'dist' : 'public';
  const destination = fileURLToPath(new URL(`../${folder}/${modelFile}`, import.meta.url));
  const existing = await readIfPresent(destination);
  if (existing && isModelBundle(existing)) {
    console.log(`${folder}/${modelFile} is a valid model bundle.`);
    return;
  }
  if (checkingBuild) throw new Error('The deployment build does not contain a complete Face Landmarker model.');

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(modelDownloadUrl, { signal: AbortSignal.timeout(35000) });
      if (!response.ok) throw new Error(`Google returned HTTP ${response.status}.`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (!isModelBundle(bytes)) throw new Error('The response is not a complete MediaPipe task bundle.');
      await mkdir(dirname(destination), { recursive: true });
      await writeFile(destination, bytes);
      console.log(`Downloaded ${modelFile} (${bytes.byteLength.toLocaleString()} bytes).`);
      return;
    } catch (error) {
      const reason = error.cause?.code ?? error.message;
      console.error(`Model download attempt ${attempt}/3 failed (${reason}).`);
      if (attempt === 3) throw new Error(`Could not download ${modelDownloadUrl}. Connect to the internet and retry, or place the official model at public/${modelFile}.`);
      await wait(attempt * 800);
    }
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
