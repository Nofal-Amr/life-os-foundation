// Runs the plain-Java tests in mobile/android/test (no phone needed):
//   npm run test:android
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const win = process.platform === "win32";
const javaHome =
  process.env.JAVA_HOME ||
  (win ? "C:\\Program Files\\Android\\Android Studio\\jbr" : "/opt/android-studio/jbr");
const bin = (tool) => join(javaHome, "bin", tool + (win ? ".exe" : ""));
if (!existsSync(bin("javac"))) throw new Error(`javac not found under ${javaHome}`);

const here = dirname(fileURLToPath(import.meta.url));
const out = mkdtempSync(join(tmpdir(), "lifeos-java-"));
// Only classes with no Android dependencies are tested here.
const sources = [join(here, "src/app/lifeos/SpendingParser.java")];
const tests = readdirSync(join(here, "test")).filter((name) => name.endsWith("Test.java"));

execFileSync(bin("javac"), ["-encoding", "UTF-8", "-d", out, ...sources, ...tests.map((t) => join(here, "test", t))], {
  stdio: "inherit",
});
for (const test of tests) {
  execFileSync(bin("java"), ["-cp", out, `app.lifeos.${test.replace(/\.java$/, "")}`], { stdio: "inherit" });
}
