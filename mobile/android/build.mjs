// Builds the Life OS Android APK without Gradle or Capacitor, using only the
// Android SDK command-line tools (aapt2, d8, zipalign, apksigner) and a JDK.
//
//   npm run build:android            -> mobile/android/build/life-os-debug.apk
//
// Env overrides: ANDROID_HOME, JAVA_HOME, ANDROID_PLATFORM (e.g. android-34),
// ANDROID_BUILD_TOOLS (e.g. 35.0.0), SKIP_WEB=1 to reuse an existing web build.
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const out = join(here, "build");
const win = process.platform === "win32";

const sdk =
  process.env.ANDROID_HOME ||
  process.env.ANDROID_SDK_ROOT ||
  (win
    ? join(process.env.LOCALAPPDATA ?? "", "Android", "Sdk")
    : join(homedir(), "Android", "Sdk"));
const javaHome =
  process.env.JAVA_HOME &&
  existsSync(join(process.env.JAVA_HOME, "bin", win ? "javac.exe" : "javac"))
    ? process.env.JAVA_HOME
    : win
      ? "C:\\Program Files\\Android\\Android Studio\\jbr"
      : "/opt/android-studio/jbr";

const latest = (dir, prefix = "") =>
  readdirSync(dir)
    .filter((name) => name.startsWith(prefix) && /^[\w.-]*\d$/.test(name) && !name.includes("ext"))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .pop();

const platform = process.env.ANDROID_PLATFORM || "android-34";
const buildTools = process.env.ANDROID_BUILD_TOOLS || latest(join(sdk, "build-tools"));
const bt = (tool) => join(sdk, "build-tools", buildTools, tool + (win ? ".exe" : ""));
// d8 and apksigner ship as jars behind .bat/.sh wrappers; call the jars directly
// so paths with spaces work everywhere.
const btJar = (name) => join(sdk, "build-tools", buildTools, "lib", name + ".jar");
const jdk = (tool) => join(javaHome, "bin", tool + (win ? ".exe" : ""));
const androidJar = join(sdk, "platforms", platform, "android.jar");

for (const [label, path] of [
  ["Android SDK", sdk],
  ["android.jar", androidJar],
  ["aapt2", bt("aapt2")],
  ["javac", jdk("javac")],
]) {
  if (!existsSync(path)) throw new Error(`${label} not found at ${path}`);
}

const run = (cmd, args, opts = {}) => {
  console.log(
    `> ${relative(root, cmd) || cmd} ${args.map((a) => (a.includes(" ") ? `"${a}"` : a)).join(" ")}`,
  );
  execFileSync(cmd, args, { stdio: "inherit", cwd: root, ...opts });
};

// 1. Static single-page web bundle.
if (process.env.SKIP_WEB !== "1") {
  run(process.execPath, [join(root, "node_modules", "vite", "bin", "vite.js"), "build"], {
    env: { ...process.env, LIFE_OS_MOBILE: "1" },
  });
}
const web = join(root, "dist", "client");
if (!existsSync(join(web, "index.html")))
  throw new Error("dist/client/index.html missing; the web build failed.");

rmSync(out, { recursive: true, force: true });
const dirs = ["res", "classes", "dex", "assets/www", "gen"].map((d) => join(out, d));
dirs.forEach((d) => mkdirSync(d, { recursive: true }));
const [resOut, classesOut, dexOut, wwwOut, genOut] = dirs;
cpSync(web, wwwOut, { recursive: true });

// 2. Resources and manifest.
const compiled = join(resOut, "res.zip");
run(bt("aapt2"), ["compile", "--dir", join(here, "res"), "-o", compiled]);
const unsigned = join(out, "unsigned.apk");
run(bt("aapt2"), [
  "link",
  "-o",
  unsigned,
  "-I",
  androidJar,
  "--manifest",
  join(here, "AndroidManifest.xml"),
  // R.java, so Java code can refer to resources (e.g. the notification icon).
  "--java",
  genOut,
  "--auto-add-overlay",
  compiled,
]);

// 3. Java -> dex.
const sources = [];
const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).forEach((e) =>
    e.isDirectory()
      ? walk(join(dir, e.name))
      : e.name.endsWith(".java") && sources.push(join(dir, e.name)),
  );
walk(join(here, "src"));
walk(genOut);
// core-lambda-stubs lets javac compile lambdas against android.jar.
run(jdk("javac"), [
  "-source",
  "8",
  "-target",
  "8",
  "-Xlint:-options",
  "-bootclasspath",
  [androidJar, join(sdk, "build-tools", buildTools, "core-lambda-stubs.jar")].join(delimiter),
  "-d",
  classesOut,
  ...sources,
]);
const classFiles = [];
const walkClasses = (dir) =>
  readdirSync(dir, { withFileTypes: true }).forEach((e) =>
    e.isDirectory()
      ? walkClasses(join(dir, e.name))
      : e.name.endsWith(".class") && classFiles.push(join(dir, e.name)),
  );
walkClasses(classesOut);
run(jdk("java"), [
  "-cp",
  btJar("d8"),
  "com.android.tools.r8.D8",
  "--release",
  "--min-api",
  "26",
  "--lib",
  androidJar,
  "--output",
  dexOut,
  ...classFiles,
]);

// 4. Add classes.dex and the web bundle, then align and sign. (Assets go in via
// jar rather than aapt2 -A, which writes backslash paths on Windows.)
run(jdk("jar"), ["-uf", unsigned, "-C", dexOut, "classes.dex", "-C", out, "assets"]);
const aligned = join(out, "aligned.apk");
run(bt("zipalign"), ["-f", "-p", "4", unsigned, aligned]);

// Standard Android debug key (the same one Android Studio uses). Not for Play Store.
const keystore = join(homedir(), ".android", "debug.keystore");
if (!existsSync(keystore)) {
  mkdirSync(dirname(keystore), { recursive: true });
  run(jdk("keytool"), [
    "-genkeypair",
    "-v",
    "-keystore",
    keystore,
    "-storepass",
    "android",
    "-alias",
    "androiddebugkey",
    "-keypass",
    "android",
    "-keyalg",
    "RSA",
    "-keysize",
    "2048",
    "-validity",
    "10000",
    "-dname",
    "CN=Android Debug,O=Android,C=US",
  ]);
}
const apk = join(out, "life-os-debug.apk");
run(jdk("java"), [
  "-jar",
  btJar("apksigner"),
  "sign",
  "--ks",
  keystore,
  "--ks-pass",
  "pass:android",
  "--ks-key-alias",
  "androiddebugkey",
  "--key-pass",
  "pass:android",
  "--out",
  apk,
  aligned,
]);
run(jdk("java"), ["-jar", btJar("apksigner"), "verify", apk]);
console.log(`\nAPK ready: ${relative(root, apk)}`);
