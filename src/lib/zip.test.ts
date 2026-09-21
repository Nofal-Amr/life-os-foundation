import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";

import { readZip } from "./zip";

/** Builds a zip with one stored and one deflated file, the two methods the reader supports. */
function makeZip(files: { name: string; text: string; deflate: boolean }[]): ArrayBuffer {
  const encoder = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  for (const file of files) {
    const name = encoder.encode(file.name);
    const raw = encoder.encode(file.text);
    const data = file.deflate ? new Uint8Array(deflateRawSync(raw)) : raw;
    const local = new Uint8Array(30 + name.length + data.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(8, file.deflate ? 8 : 0, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, raw.length, true);
    lv.setUint16(26, name.length, true);
    local.set(name, 30);
    local.set(data, 30 + name.length);
    const central = new Uint8Array(46 + name.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(10, file.deflate ? 8 : 0, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, raw.length, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true);
    central.set(name, 46);
    locals.push(local);
    centrals.push(central);
    offset += local.length;
  }
  const centralSize = centrals.reduce((sum, c) => sum + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  const parts = [...locals, ...centrals, end];
  const out = new Uint8Array(parts.reduce((sum, p) => sum + p.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out.buffer;
}

describe("zip reader", () => {
  it("reads stored and deflated entries", async () => {
    const zip = makeZip([
      { name: "a/com.samsung.health.weight.1.csv", text: "stored text", deflate: false },
      { name: "a/big.csv", text: "deflated ".repeat(50), deflate: true },
    ]);
    const entries = await readZip(zip);
    expect(entries.map((e) => e.name)).toEqual(["a/com.samsung.health.weight.1.csv", "a/big.csv"]);
    expect(await entries[0]!.text()).toBe("stored text");
    expect(await entries[1]!.text()).toBe("deflated ".repeat(50));
  });

  it("rejects files that aren't zips", async () => {
    await expect(
      readZip(new TextEncoder().encode("not a zip at all, just text here.").buffer),
    ).rejects.toThrow();
  });
});
