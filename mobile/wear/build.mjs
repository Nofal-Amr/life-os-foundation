// Builds the watch app (Gradle) and copies it next to the phone APKs:
// mobile/android/build/life-os-wear.apk
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const sdk = process.env.ANDROID_HOME ?? join(process.env.LOCALAPPDATA ?? "", "Android", "Sdk");
const javaHome = process.env.JAVA_HOME ?? "C:/Program Files/Android/Android Studio/jbr";

// Gradle: the one Android Studio already downloaded.
const dists = join(homedir(), ".gradle", "wrapper", "dists", "gradle-8.11.1-bin");
const hash = existsSync(dists) ? readdirSync(dists)[0] : null;
if (!hash) throw new Error("Gradle 8.11.1 not found. Open the project once in Android Studio.");
const gradle = join(dists, hash, "gradle-8.11.1", "bin", process.platform === "win32" ? "gradle.bat" : "gradle");

const slashes = (path) => path.split("\\").join("/");
writeFileSync(join(here, "local.properties"), `sdk.dir=${slashes(sdk)}\n`);
// Java on Windows needs a plain folder for its local sockets (the user temp
// path can break them: "Unable to establish loopback connection").
const tmp = join(here, ".gradle", "tmp");
mkdirSync(tmp, { recursive: true });

// Node only runs .bat files through the shell, so quote the path (it has a space).
const windows = process.platform === "win32";
execFileSync(windows ? `"${gradle}"` : gradle, ["--no-daemon", ":app:testDebugUnitTest", ":app:assembleRelease"], {
  cwd: here,
  stdio: "inherit",
  shell: windows,
  env: {
    ...process.env,
    JAVA_HOME: javaHome,
    JAVA_TOOL_OPTIONS: `-Djdk.net.unixdomain.tmpdir="${slashes(tmp)}"`,
  },
});

const out = join(here, "..", "android", "build");
mkdirSync(out, { recursive: true });
copyFileSync(join(here, "app", "build", "outputs", "apk", "release", "app-release.apk"), join(out, "life-os-wear.apk"));
console.log("\nWatch APK ready: mobile/android/build/life-os-wear.apk");
