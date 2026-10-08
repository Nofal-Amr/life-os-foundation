// Copies the on-device engines into public/ so they're served by the app
// itself — no CDN, works offline and inside the Android app:
// - public/ocr: the photo reader (tesseract.js);
// - public/ai: llama.cpp in WebAssembly (wllama) for on-device AI. The model
//   itself is downloaded only when you turn AI on.
// Runs before dev and build; neither folder is committed.
import { copyFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "public", "ocr");
mkdirSync(out, { recursive: true });

const files = [
  ["node_modules/tesseract.js/dist/worker.min.js", "worker.min.js"],
  // LSTM-only engine in three builds; the worker picks what the device supports.
  ["node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js", "tesseract-core-lstm.wasm.js"],
  ["node_modules/tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js", "tesseract-core-relaxedsimd-lstm.wasm.js"],
  ["node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js", "tesseract-core-simd-lstm.wasm.js"],
  ["node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz", "eng.traineddata.gz"],
];

const aiOut = join(root, "public", "ai");
mkdirSync(aiOut, { recursive: true });
const jobs = [
  ...files.map(([from, to]) => [from, join(out, to)]),
  ["node_modules/@wllama/wllama/esm/wasm/wllama.wasm", join(aiOut, "wllama.wasm")],
];

for (const [from, target] of jobs) {
  const source = join(root, from);
  if (!existsSync(source)) throw new Error(`OCR asset missing: ${from} (run your package install)`);
  if (existsSync(target) && statSync(target).size === statSync(source).size) continue;
  copyFileSync(source, target);
}
