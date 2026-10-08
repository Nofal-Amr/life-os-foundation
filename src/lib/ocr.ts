/**
 * Reading numbers and receipts from a photo, on the device: tesseract.js,
 * served from /ocr (see scripts/ocr-assets.mjs), so no image ever leaves the
 * phone and it works offline. Always shown to you to confirm — never saved
 * on its own.
 */
import type { Worker } from "tesseract.js";

let workerPromise: Promise<Worker> | null = null;

async function worker(): Promise<Worker> {
  workerPromise ??= (async () => {
    const { createWorker } = await import("tesseract.js");
    const base = `${window.location.origin}/ocr/`;
    return createWorker("eng", 1, {
      workerPath: `${base}worker.min.js`,
      corePath: base,
      langPath: base,
      gzip: true,
      workerBlobURL: false,
    });
  })().catch((error) => {
    workerPromise = null;
    throw error;
  });
  return workerPromise;
}

/** Downscale, grey and stretch the contrast: LCD and receipt digits read better. */
async function prepare(image: Blob, invert = false): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(image);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d", { willReadFrequently: true })!;
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  const data = pixels.data;
  let min = 255;
  let max = 0;
  for (let i = 0; i < data.length; i += 4) {
    const grey = 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!;
    data[i] = grey;
    if (grey < min) min = grey;
    if (grey > max) max = grey;
  }
  const range = Math.max(1, max - min);
  for (let i = 0; i < data.length; i += 4) {
    let value = ((data[i]! - min) / range) * 255;
    if (invert) value = 255 - value;
    data[i] = data[i + 1] = data[i + 2] = value;
  }
  context.putImageData(pixels, 0, 0);
  return canvas;
}

/** Text in a photo. digits: only 0-9 and separators (meters, odometers). */
export async function readPhoto(image: Blob, mode: "digits" | "text"): Promise<string> {
  const ocr = await worker();
  await ocr.setParameters({
    tessedit_char_whitelist: mode === "digits" ? "0123456789.," : "",
    // 11 = sparse text: find numbers wherever they are on the display.
    tessedit_pageseg_mode: (mode === "digits" ? "11" : "3") as never,
  });
  const first = await ocr.recognize(await prepare(image));
  if (mode === "text" || numbersIn(first.data.text).length) return first.data.text;
  // Light digits on a dark display: try it inverted.
  const second = await ocr.recognize(await prepare(image, true));
  return `${first.data.text}\n${second.data.text}`;
}

/* ------------------------------------------------------------- reading */

/** Numbers in the text, longest first (a meter's reading is usually the longest). */
export function numbersIn(text: string): number[] {
  const seen = new Set<number>();
  const found: { value: number; digits: number }[] = [];
  for (const match of text.matchAll(/\d[\d,]*(?:\.\d+)?/g)) {
    const raw = match[0].replace(/,(?=\d{3}\b)/g, "").replace(",", ".");
    const value = Number(raw);
    if (!Number.isFinite(value) || seen.has(value)) continue;
    seen.add(value);
    found.push({ value, digits: raw.replace(/\D/g, "").length });
  }
  return found.sort((a, b) => b.digits - a.digits || b.value - a.value).map((item) => item.value);
}

const TOTAL_WORDS =
  /\b(grand\s*total|total\s*(due|amount|egp|le)?|amount\s*due|net\s*total|to\s*pay|balance\s*due)\b|الإجمالي|الاجمالي|المجموع|الصافي|المطلوب/i;
const NOT_TOTAL = /\b(sub\s*-?\s*total|subtotal|vat|tax|discount|change|cash|tip|service)\b|خصم|ضريبة|الباقي/i;
const AMOUNT = /(\d{1,3}(?:[,\s]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)/g;

function amountsOn(line: string): number[] {
  return [...line.matchAll(AMOUNT)]
    .map((m) => Number(m[1]!.replace(/[,\s](?=\d{3}\b)/g, "").replace(",", ".")))
    .filter((value) => Number.isFinite(value) && value > 0);
}

/**
 * A receipt's total and shop: the amount on the "Total" line (not subtotal or
 * VAT), else the largest amount; the shop is the first line with letters.
 */
export function receiptFrom(text: string): { total: number | null; merchant: string | null } {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  let total: number | null = null;
  for (let i = lines.length - 1; i >= 0 && total == null; i--) {
    const line = lines[i]!;
    if (!TOTAL_WORDS.test(line) || NOT_TOTAL.test(line)) continue;
    const here = amountsOn(line);
    const next = here.length ? here : amountsOn(lines[i + 1] ?? "");
    if (next.length) total = next[next.length - 1]!;
  }
  if (total == null) {
    const all = lines.flatMap(amountsOn).filter((value) => value < 1_000_000);
    total = all.length ? Math.max(...all) : null;
  }
  const merchant =
    lines.find((line) => /[A-Za-z؀-ۿ]{3,}/.test(line) && !/receipt|invoice|فاتورة|tax/i.test(line)) ?? null;
  return { total, merchant: merchant ? merchant.slice(0, 60) : null };
}
