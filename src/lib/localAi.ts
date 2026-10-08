/**
 * On-device AI: a small open model (Qwen2.5 0.5B Instruct, ~400 MB) run by
 * llama.cpp compiled to WebAssembly (wllama), entirely on this device. The
 * model is downloaded once, only when you turn it on in Settings, and kept
 * in the browser's storage; after that it works offline and nothing you
 * type leaves the device. Suggestions are always shown for you to pick —
 * never saved on their own.
 */
import type { Wllama } from "@wllama/wllama/esm/index.js";

export const AI_MODEL = {
  repo: "Qwen/Qwen2.5-0.5B-Instruct-GGUF",
  file: "qwen2.5-0.5b-instruct-q4_k_m.gguf",
  label: "Qwen2.5 0.5B",
  sizeMb: 400,
} as const;

let engine: Promise<Wllama> | null = null;
let loaded: Promise<void> | null = null;

async function getEngine(): Promise<Wllama> {
  engine ??= (async () => {
    const { Wllama } = await import("@wllama/wllama/esm/index.js");
    return new Wllama(
      { default: `${window.location.origin}/ai/wllama.wasm` },
      { suppressNativeLog: true, allowOffline: true },
    );
  })().catch((error) => {
    engine = null;
    throw error;
  });
  return engine;
}

/** Whether the model is on this device already. */
export async function modelDownloaded(): Promise<boolean> {
  try {
    const ai = await getEngine();
    const files = await ai.cacheManager.list();
    return files.some((entry) => entry.name.includes(AI_MODEL.file));
  } catch {
    return false;
  }
}

/** Downloads (if needed) and loads the model; progress 0–1. */
export async function loadModel(onProgress?: (fraction: number) => void): Promise<void> {
  loaded ??= (async () => {
    const ai = await getEngine();
    await ai.loadModelFromHF(
      { repo: AI_MODEL.repo, file: AI_MODEL.file },
      {
        n_ctx: 2048,
        progressCallback: ({ loaded: done, total }) => {
          if (total > 0) onProgress?.(done / total);
        },
      },
    );
  })().catch((error) => {
    loaded = null;
    throw error;
  });
  return loaded;
}

export async function deleteModel(): Promise<void> {
  const ai = await getEngine();
  try {
    await ai.exit();
  } catch {
    // Not loaded.
  }
  engine = null;
  loaded = null;
  const fresh = await getEngine();
  const files = await fresh.cacheManager.list();
  for (const entry of files)
    if (entry.name.includes(AI_MODEL.file)) await fresh.cacheManager.delete(entry.name);
}

async function ask(system: string, user: string, maxTokens = 220): Promise<string> {
  await loadModel();
  const ai = await getEngine();
  const response = await ai.createChatCompletion({
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    max_tokens: maxTokens,
    temperature: 0.3,
  });
  return response.choices[0]?.message?.content ?? "";
}

/** Lines of a numbered or bulleted reply, cleaned, deduplicated, at most `max`. */
export function parseList(reply: string, max = 8): string[] {
  const seen = new Set<string>();
  const items: string[] = [];
  for (const line of reply.split(/\r?\n/)) {
    const item = line
      .replace(/^\s*(?:[-*•–—]|\d+[.)]|step\s*\d+[:.)-]?)\s*/i, "")
      .replace(/\*\*/g, "")
      .replace(/[.;]+$/, "")
      .trim();
    if (!item || item.length > 120 || /^(here|sure|steps?|tasks?)\b.*:$/i.test(item)) continue;
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(item);
    if (items.length >= max) break;
  }
  return items;
}

/** 3–6 small first steps for a task. */
export async function suggestSteps(task: string): Promise<string[]> {
  const reply = await ask(
    "You help people with ADHD start tasks. Break the task into 3 to 6 small, concrete, physical steps, in order. Each step under 8 words, starting with a verb. Reply with only a numbered list.",
    `Task: ${task.slice(0, 300)}`,
  );
  return parseList(reply, 6);
}

/** Things to do, pulled out of a note or a rant. */
export async function tasksFromText(text: string): Promise<string[]> {
  const reply = await ask(
    "Pull out the concrete things this person needs to do. Each as a short task under 10 words, starting with a verb. Skip feelings and background. Reply with only a numbered list; if there is nothing to do, reply with nothing.",
    text.slice(0, 3000),
    260,
  );
  return parseList(reply, 10);
}
