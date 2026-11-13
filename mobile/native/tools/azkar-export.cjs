// Usage: node mobile/native/tools/azkar-export.cjs src/data/azkar.ts mobile/native/app/src/main/assets/azkar.json
// Reads src/data/azkar.ts and writes the azkar texts, tasbih phrases and targets as JSON,
// byte for byte, so the phone shows exactly what the website shows.
const fs = require("fs");
const [src, out] = process.argv.slice(2);
const ts = fs.readFileSync(src, "utf8");
const pick = (start, end) => {
  const a = ts.indexOf(start), b = ts.indexOf(end, a);
  if (a < 0 || b < 0) throw new Error("marker not found: " + start);
  return ts.slice(a, b);
};
let body = pick("const AYAT_AL_KURSI", "const SURAH_AR") + pick("export const AZKAR", "/** The azkar for one time of day") +
  pick("export const TASBIH_PHRASES", "/* ----");
body = body.replace(/export /g, "").replace(/: Zikr\[\]/g, "").replace(/ as const/g, "");
const fn = new Function(body + "; return { azkar: AZKAR, tasbihPhrases: TASBIH_PHRASES, tasbihTargets: TASBIH_TARGETS };");
const data = fn();
fs.writeFileSync(out, JSON.stringify(data, null, 1) + "\n", "utf8");
console.log(data.azkar.length + " azkar, " + data.tasbihPhrases.length + " phrases, targets " + data.tasbihTargets.join(","));
