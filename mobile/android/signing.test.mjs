import { describe, expect, it } from "vitest";

import { signingPlan } from "./signing.mjs";

const root = "/work/life-os";
const debugKeystore = "/home/me/.android/debug.keystore";

describe("Android signing", () => {
  it("debug builds stay debuggable with the debug key", () => {
    const plan = signingPlan({ release: false, full: false, env: {}, root, debugKeystore });
    expect(plan.debuggable).toBe(true);
    expect(plan.keystore).toBe(debugKeystore);
    expect(plan.apkName).toBe("life-os-debug.apk");
    expect(signingPlan({ release: false, full: true, env: {}, root, debugKeystore }).apkName).toBe(
      "life-os-full.apk",
    );
  });

  it("release builds are not debuggable and use the owner's key", () => {
    const env = { LIFEOS_KEYSTORE: "/keys/lifeos.jks", LIFEOS_KEYSTORE_PASSWORD: "secret" };
    const plan = signingPlan({ release: true, full: true, env, root, debugKeystore });
    expect(plan.debuggable).toBe(false);
    expect(plan.keystore).toBe("/keys/lifeos.jks");
    expect(plan.alias).toBe("lifeos");
    expect(plan.apkName).toBe("life-os-full-release.apk");
  });

  it("never puts a password on the command line", () => {
    const env = {
      LIFEOS_KEYSTORE: "/keys/lifeos.jks",
      LIFEOS_KEYSTORE_PASSWORD: "secret",
      LIFEOS_KEY_PASSWORD: "other",
    };
    const plan = signingPlan({ release: true, full: false, env, root, debugKeystore });
    expect(plan.storePass).toBe("env:LIFEOS_KEYSTORE_PASSWORD");
    expect(plan.keyPass).toBe("env:LIFEOS_KEY_PASSWORD");
    expect(JSON.stringify(plan)).not.toContain("secret");
    expect(JSON.stringify(plan)).not.toContain("other");
  });

  it("refuses a release build with no key", () => {
    expect(() => signingPlan({ release: true, full: false, env: {}, root, debugKeystore })).toThrow(
      /LIFEOS_KEYSTORE and LIFEOS_KEYSTORE_PASSWORD/,
    );
  });

  it("refuses a keystore kept inside the repository", () => {
    const env = { LIFEOS_KEYSTORE: `${root}/keys/lifeos.jks`, LIFEOS_KEYSTORE_PASSWORD: "x" };
    expect(() => signingPlan({ release: true, full: false, env, root, debugKeystore })).toThrow(
      /inside the repository/,
    );
  });
});
