"""Derive the Lei v3 candidate from the sealed v2 archive and committed runtime files."""

import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess
import zipfile


ROOT = Path(__file__).resolve().parents[1]
BASE_SHA = "c8fc8befd55f03734e10429bb85785a977f4860afde1a6b4bc7d66f99783f277"
SKILL = "drlt_xiongluan"
SOURCE = "score/decision/skills/"
RUNTIME = ("packs/shenhuaLei.js", "rules/shenhuaLei.js")
STATUS = {
    "pack_status": "v3 候选，验收以独立报告为准",
    "delivery_status": "候选待验收",
    "can_mark_deliverable": False,
}
STAGE = {"delivery_stage": "阶段性", "complete_delivery": False}


def git(*args):
    return subprocess.check_output(["git", *args], cwd=ROOT)


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def json_bytes(obj):
    return (json.dumps(obj, ensure_ascii=False, indent=2) + "\n").encode()


def replace_patch_section(patch, path, blob, body):
    marker = f"diff --git a/{path} b/{path}\n".encode()
    start = patch.index(marker)
    end = patch.find(b"\ndiff --git ", start)
    suffix = b"" if end < 0 else patch[end + 1:]
    if b"--- /dev/null\n" not in patch[start:len(patch) if end < 0 else end]:
        raise ValueError(f"Expected a new-file patch section for {path}")
    lines = body.splitlines(keepends=True)
    if not lines or not body.endswith(b"\n"):
        raise ValueError(f"Expected a nonempty LF Git blob for {path}")
    header = f"new file mode 100644\nindex 0000000..{blob[:7]}\n--- /dev/null\n+++ b/{path}\n@@ -0,0 +1,{len(lines)} @@\n"
    return patch[:start] + marker + header.encode() + b"".join(b"+" + line for line in lines) + suffix


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sealed", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--source-head", required=True)
    args = parser.parse_args()
    head = args.source_head
    if not re.fullmatch(r"[a-f0-9]{40}", head) or git("rev-parse", f"{head}^{{commit}}").decode().strip() != head:
        raise ValueError("Use the full committed source HEAD")
    if sha256(args.sealed.read_bytes()) != BASE_SHA:
        raise ValueError("Sealed input SHA256 mismatch")
    with zipfile.ZipFile(args.sealed) as sealed:
        infos = sealed.infolist()
        data = {info.filename: sealed.read(info) for info in infos}
    if len(data) != len(infos):
        raise ValueError("Duplicate ZIP entries")
    manifest = json.loads(data["manifest.json"])
    package = manifest["package"]
    pack = json.loads(data["pack.json"])
    checklist = json.loads(data["checklist.json"])
    base = {"head": pack["head"], "sha256": BASE_SHA, "scope": "v2 sealed archive"}
    provenance = {"sealed_input": base, "changed_source_head": head}
    metadata = {"head": head, "source_mode": "sealed-v2-plus-git-blobs", "v3_provenance": provenance}
    for doc in (package, pack, checklist):
        doc.update(STATUS)
        doc["v2_acceptance_counts"] = doc.pop("counts")
        doc["counts"] = {**doc["v2_acceptance_counts"], "extension_wired_skills": 5}
        # These v2 totals require v3 acceptance evidence before recomputing them.
        for field in ("fixed_skills", "verified_skills", "runtime_verified_skills", "skill_status"):
            doc["counts"].pop(field, None)
        doc["v3_changed_skills"] = [SKILL]
    for doc in (package, pack):
        doc.update(STAGE)
        doc.update(metadata)
        doc["implemented_skills"].append(SKILL)
    pack["all_registered_skills"].append(SKILL)
    package["head_short"] = head[:7]
    checklist["v3_provenance"] = provenance
    for record in checklist["records"]:
        if record.get("skill") == SKILL or record.get("skill_id") == SKILL:
            record["v3_status"] = STATUS["delivery_status"]

    updated = {}
    patch_name = "patches/pack-code.diff"
    patch = data[patch_name]
    for relative in RUNTIME:
        path = SOURCE + relative
        name = "source/" + path
        body = git("show", f"{head}:{path}")
        blob = git("rev-parse", f"{head}:{path}").decode().strip()
        if body == data[name]:
            raise ValueError(f"Expected a change in {path}")
        updated[name] = body
        pack["pack_files"][relative] = sha256(body)
        patch = replace_patch_section(patch, path, blob, body)
    updated[patch_name] = patch
    updated["pack.json"] = json_bytes(pack)
    updated["checklist.json"] = json_bytes(checklist)
    banner = (
        "## v3 扩展候选\n\n"
        f"雄乱 \`{SKILL}\` 的扩展评分来自 \`{head}\`。"
        "v3 验收和交付状态以同版外层 \`ACCEPTANCE.md\` 为准。"
        "包内历史证据、下方覆盖数字和可选原生补丁均来自 v2。"
        "可选原生补丁不包含本次雄乱扩展修复，也不属于十六包正式组合。\n\n"
    )
    for name in ("README.md", "checklist.md", "COMMANDS.md"):
        old_title, _, content = data[name].decode().partition("\n")
        title = old_title.replace("（可交付）", "（v3 候选）")
        updated[name] = (title + "\n\n" + banner + content.lstrip("\n")).encode()
    manifest["generated_at"] = git("show", "-s", "--format=%cI", head).decode().strip()
    entries = {entry["path"]: entry for entry in manifest["files"]}
    for name, body in updated.items():
        entry = entries[name]
        entry.update(size=len(body), sha256=sha256(body))
        if name.startswith("source/"):
            entry["commit"] = head
        if name == patch_name:
            entry.update(commit=head, source_kind="generated", repo_path=None)
    updated["manifest.json"] = json_bytes(manifest)

    with zipfile.ZipFile(args.output, "x", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as candidate:
        for info in infos:
            candidate.writestr(info, updated.get(info.filename, data[info.filename]))
    print(sha256(args.output.read_bytes()), args.output)


if __name__ == "__main__":
    main()
