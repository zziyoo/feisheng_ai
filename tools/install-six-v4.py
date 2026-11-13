"""Install the six v4 ZIPs into an isolated extension root and record transactions."""

import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import zipfile


ORDER = ["refresh-standard", "refresh-feng", "shenhua-feng", "shenhua-huo", "shenhua-lei", "out-of-scope"]


def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--packs-dir", required=True, type=Path)
    parser.add_argument("--base-zip", required=True, type=Path)
    parser.add_argument("--workdir", required=True, type=Path)
    parser.add_argument("--skip-install", action="store_true")
    args = parser.parse_args()
    workdir = args.workdir.resolve()
    extension = workdir / "extension"
    if not extension.exists():
        extension.mkdir(parents=True)
        with zipfile.ZipFile(args.base_zip) as archive:
            archive.extractall(extension)
    for pack in ORDER:
        target = workdir / pack
        if not target.exists():
            target.mkdir(parents=True)
            with zipfile.ZipFile(args.packs_dir / f"feisheng-ai-{pack}.zip") as archive:
                archive.extractall(target)
    if not args.skip_install:
        diff = workdir / ORDER[0] / "patches" / "score-index.diff"
        subprocess.run(["git", "-c", "core.autocrlf=false", "apply", "--check", str(diff)], cwd=extension, check=True)
        subprocess.run(["git", "-c", "core.autocrlf=false", "apply", str(diff)], cwd=extension, check=True)
    evidence = {}
    if not args.skip_install:
        for pack in ORDER:
            extracted = workdir / pack
            command = ["node", str(extracted / "integration" / "apply-pack.mjs"), "--extension-root", str(extension)]
            dry = subprocess.run(command + ["--dry-run"], cwd=extracted, capture_output=True, text=True, encoding="utf-8", errors="replace")
            if dry.returncode:
                raise RuntimeError(f"{pack} dry-run failed: {dry.stdout}\n{dry.stderr}")
            applied = subprocess.run(command, cwd=extracted, capture_output=True, text=True, encoding="utf-8", errors="replace")
            if applied.returncode:
                raise RuntimeError(f"{pack} apply failed: {applied.stdout}\n{applied.stderr}")
            evidence[pack] = {
                "zip": str(args.packs_dir / f"feisheng-ai-{pack}.zip"),
                "zip_sha256": sha256(args.packs_dir / f"feisheng-ai-{pack}.zip"),
                "dry_run": json.loads(dry.stdout),
                "applied": json.loads(applied.stdout),
            }
        record = {
            "base_zip": str(args.base_zip),
            "base_zip_sha256": sha256(args.base_zip),
            "extension_root": str(extension),
            "order": ORDER,
            "packs": evidence,
        }
        (workdir / "install.json").write_text(json.dumps(record, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(extension)
    print("PASS: six v4 dry-run and installs")


if __name__ == "__main__":
    main()
