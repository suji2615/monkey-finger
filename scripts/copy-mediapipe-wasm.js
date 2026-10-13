import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const packageDirectory = dirname(require.resolve('@mediapipe/tasks-vision'));
const sourceDirectory = resolve(packageDirectory, 'wasm');
const destinationDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '../public/mediapipe/wasm');
const wasmFiles = [
  'vision_wasm_internal.js',
  'vision_wasm_internal.wasm',
  'vision_wasm_nosimd_internal.js',
  'vision_wasm_nosimd_internal.wasm',
];

mkdirSync(destinationDirectory, { recursive: true });

for (const file of wasmFiles) {
  copyFileSync(resolve(sourceDirectory, file), resolve(destinationDirectory, file));
}
