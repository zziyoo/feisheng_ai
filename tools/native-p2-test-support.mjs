import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const native = fileURLToPath(new URL("../docs/remaining-ten-packs/native/", import.meta.url));

export function patchedSources(pack, files) {
  const host = process.argv[2];
  if (!host) throw new Error("Pass the clean 1.11.7 host application directory");
  const tempRoot = resolve(tmpdir());
  const sandbox = mkdtempSync(join(tempRoot, "feisheng-native-p2-"));
  try {
    for (const file of files) {
      const output = join(sandbox, file);
      mkdirSync(dirname(output), { recursive: true });
      copyFileSync(join(host, file), output);
    }
    execFileSync("git", ["-c", "core.autocrlf=false", "apply", join(native, pack + ".patch")], {
      cwd: sandbox,
      stdio: "pipe"
    });
    return Object.fromEntries(files.map(file => [file, readFileSync(join(sandbox, file), "utf8")]));
  } finally {
    if (dirname(sandbox) !== tempRoot) throw new Error("Unexpected test directory");
    rmSync(sandbox, { recursive: true, force: true });
  }
}

export function loadSkill(source, skill, globals) {
  const start = source.indexOf("  " + skill + ": {");
  if (start === -1) throw new Error("Missing skill " + skill);
  const end = source.indexOf("\n  },", start);
  if (end === -1) throw new Error("Missing end of skill " + skill);
  const body = source.slice(start + skill.length + 4, end + 4);
  return vm.runInNewContext("(" + body + ")", globals);
}
