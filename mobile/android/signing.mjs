// How the Android APK is signed. Kept apart from build.mjs so it can be tested
// (mobile/android/signing.test.mjs).
//
// Debug builds (the default) are for the owner's own phone: debuggable, and
// signed with the standard Android debug key.
//
// Release builds (--release) are for anything given to other people: not
// debuggable, and signed with the owner's release key. The key and its
// passwords stay outside the repository and are read from the environment:
//   LIFEOS_KEYSTORE           path to the keystore file
//   LIFEOS_KEYSTORE_PASSWORD  keystore password
//   LIFEOS_KEY_ALIAS          key alias (default: lifeos)
//   LIFEOS_KEY_PASSWORD       key password (default: the keystore password)
// See docs/android-release-signing.md.
import { isAbsolute, relative, resolve } from "node:path";

/** Debug key, the same one Android Studio uses. Never for anything given to others. */
export const DEBUG_KEY = {
  alias: "androiddebugkey",
  password: "android",
};

/**
 * What to sign with. Throws with a readable message when a release build is
 * missing its key, or the key sits inside the repository.
 *
 * Passwords are returned as apksigner "env:" references, so they never appear
 * in the command line the build prints.
 */
export function signingPlan({ release, full, env, root, debugKeystore }) {
  const name = `life-os${full ? "-full" : ""}${release ? "-release" : full ? "" : "-debug"}.apk`;
  if (!release) {
    return {
      debuggable: true,
      keystore: debugKeystore,
      alias: DEBUG_KEY.alias,
      storePass: `pass:${DEBUG_KEY.password}`,
      keyPass: `pass:${DEBUG_KEY.password}`,
      apkName: name,
    };
  }
  const missing = ["LIFEOS_KEYSTORE", "LIFEOS_KEYSTORE_PASSWORD"].filter((key) => !env[key]);
  if (missing.length) {
    throw new Error(
      `A release build needs ${missing.join(" and ")}. See docs/android-release-signing.md.`,
    );
  }
  const keystore = resolve(env.LIFEOS_KEYSTORE);
  const inside = relative(resolve(root), keystore);
  if (!inside.startsWith("..") && !isAbsolute(inside)) {
    throw new Error(
      "The release keystore is inside the repository. Keep it outside, so it can never be committed.",
    );
  }
  return {
    debuggable: false,
    keystore,
    alias: env.LIFEOS_KEY_ALIAS || "lifeos",
    storePass: "env:LIFEOS_KEYSTORE_PASSWORD",
    keyPass: env.LIFEOS_KEY_PASSWORD ? "env:LIFEOS_KEY_PASSWORD" : "env:LIFEOS_KEYSTORE_PASSWORD",
    apkName: name,
  };
}
