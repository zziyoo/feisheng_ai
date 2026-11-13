"""Derive a v4 pack from the sealed v3 archive and committed v4 runtime blobs.

The v3 archive remains the byte source for every unchanged member. Only the
requested runtime files and delivery metadata are replaced; ZIP entry order and
timestamps are preserved so the result is reproducible from the sealed input.
"""

import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess
import zipfile


ROOT = Path(__file__).resolve().parents[1]
SOURCE = "score/decision/skills/"
SEALED_SHA = {
    "refresh_feng": "193085553119f7cc56769b474994b4f1868439413de7e657811dc1e73b7f70ef",
    "shenhua_feng": "dcfac0a35ea231c3838912a1681e27006530e5b0d549e94f4a62376e555c658c",
    "shenhua_huo": "68a180f26cb47f33ffe6ff7af95ff3cb2767d1dfd0de829611f6380173e43f0d",
    "shenhua_lei": "40d9ef55299319e9337c2b767e6220536ba32c3de0d0f05e8681611a0db9a6f4",
}


def git(*args):
    return subprocess.check_output(["git", *args], cwd=ROOT)


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def json_bytes(obj):
    return (json.dumps(obj, ensure_ascii=False, indent=2) + "\n").encode()


def replace_patch_section(patch, path, blob, body):
    marker = f"diff --git a/{path} b/{path}\n".encode()
    if marker not in patch:
        return patch
    start = patch.index(marker)
    end = patch.find(b"\ndiff --git ", start)
    suffix = b"" if end < 0 else patch[end + 1:]
    section = patch[start:len(patch) if end < 0 else end]
    if b"--- /dev/null\n" not in section:
        raise ValueError(f"Expected a new-file patch section for {path}")
    lines = body.splitlines(keepends=True)
    if not lines or not body.endswith(b"\n"):
        raise ValueError(f"Expected a nonempty LF Git blob for {path}")
    header = (
        f"new file mode 100644\nindex 0000000..{blob[:7]}\n"
        f"--- /dev/null\n+++ b/{path}\n@@ -0,0 +1,{len(lines)} @@\n"
    )
    return patch[:start] + marker + header.encode() + b"".join(b"+" + line for line in lines) + suffix


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pack-id", required=True, choices=sorted(SEALED_SHA))
    parser.add_argument("--sealed", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--source-head", required=True)
    parser.add_argument("--replace", default="", help="Comma separated pack/rules paths")
    parser.add_argument("--skills-add", default="")
    parser.add_argument("--changed-skills", default="")
    parser.add_argument("--peer-sha256", default="")
    parser.add_argument("--metadata-only", action="store_true")
    parser.add_argument("--final", action="store_true")
    parser.add_argument("--build-head", default="")
    parser.add_argument("--note", default="")
    args = parser.parse_args()

    head = args.source_head
    if not re.fullmatch(r"[a-f0-9]{40}", head):
        raise ValueError("Use the full committed source HEAD")
    if git("rev-parse", f"{head}^{{commit}}").decode().strip() != head:
        raise ValueError("Source HEAD is not a full commit")
    sealed_sha = sha256(args.sealed.read_bytes())
    if sealed_sha != SEALED_SHA[args.pack_id]:
        raise ValueError(f"Sealed {args.pack_id} SHA256 mismatch: {sealed_sha}")
    if args.output.exists():
        raise ValueError(f"Output already exists: {args.output}")

    with zipfile.ZipFile(args.sealed) as sealed:
        infos = sealed.infolist()
        data = {info.filename: sealed.read(info) for info in infos}
    if len(data) != len(infos):
        raise ValueError("Duplicate ZIP entries")

    manifest = json.loads(data["manifest.json"])
    package = manifest["package"]
    pack = json.loads(data["pack.json"])
    checklist = json.loads(data.get("checklist.json", b"{}"))
    old_head = pack["head"]
    updated = {}
    changed_files = []
    changed_skills = [item for item in args.changed_skills.split(",") if item]
    skills_add = [item for item in args.skills_add.split(",") if item]
    replacements = [item for item in args.replace.split(",") if item]

    patch_name = "patches/pack-code.diff"
    patch = data.get(patch_name)
    for relative in replacements:
        repo_path = SOURCE + relative
        name = "source/" + repo_path
        if name not in data:
            raise ValueError(f"Sealed archive lacks {name}")
        body = git("show", f"{head}:{repo_path}")
        if body == data[name]:
            raise ValueError(f"Expected a runtime change in {repo_path}")
        blob = git("rev-parse", f"{head}:{repo_path}").decode().strip()
        updated[name] = body
        changed_files.append(repo_path)
        pack["pack_files"][relative] = sha256(body)
        if patch is not None:
            patch = replace_patch_section(patch, repo_path, blob, body)
    if patch is not None and patch != data[patch_name]:
        updated[patch_name] = patch

    if args.metadata_only and replacements:
        raise ValueError("--metadata-only cannot replace runtime files")
    if not args.metadata_only and not replacements:
        raise ValueError("At least one --replace is required unless metadata-only")
    if args.peer_sha256 and not re.fullmatch(r"[a-f0-9]{64}", args.peer_sha256):
        raise ValueError("Invalid peer SHA256")
    if args.peer_sha256:
        if "wind_compatibility" not in pack:
            raise ValueError("Pack has no wind_compatibility")
        pack["wind_compatibility"]["peer_sha256"] = args.peer_sha256

    for skill in skills_add:
        if skill not in pack.get("implemented_skills", []):
            pack.setdefault("implemented_skills", []).append(skill)
        if skill not in pack.get("all_registered_skills", []):
            pack.setdefault("all_registered_skills", []).append(skill)

    status = {
        "delivery_stage": "内部验收通过" if args.final else "v4 候选，验收以独立报告为准",
        "complete_delivery": bool(args.final),
        "pack_status": "内部验收通过" if args.final else "v4 候选，验收以独立报告为准",
        "delivery_status": "内部验收通过" if args.final else "候选待验收",
        "can_mark_deliverable": bool(args.final),
    }
    provenance = {
        "sealed_input": {"file": args.sealed.name, "sha256": sealed_sha, "head": old_head},
        "source_head": head,
        "runtime_changed": bool(replacements),
        "metadata_only": bool(args.metadata_only),
        "changed_files": changed_files,
        "changed_skills": changed_skills,
        "peer_update": ({"sha256": args.peer_sha256} if args.peer_sha256 else None),
        "build_tool": "tools/build-v4-pack.py",
        "build_head": args.build_head or None,
        "note": args.note or None,
    }
    source_mode = "sealed-v3-metadata" if args.metadata_only else "sealed-v3-plus-git-blobs"
    if not args.metadata_only:
        pack["head"] = head
    pack.update(status)
    pack["source_mode"] = source_mode
    pack["v4_provenance"] = provenance
    pack["v4_changed_skills"] = changed_skills
    pack["publication_status"] = "未发布"
    pack["v4_counts_note"] = "counts 保留 v3 历史统计；v4 改动以 v4_changed_skills 和交付目录 P2-RESOLUTION 为准。"

    if checklist:
        checklist.update({key: status[key] for key in ("complete_delivery", "pack_status", "delivery_status", "can_mark_deliverable")})
        checklist["delivery_stage"] = status["delivery_stage"]
        checklist["v4_provenance"] = provenance
        checklist["v4_changed_skills"] = changed_skills
        for record in checklist.get("records", []):
            skill = record.get("skill") or record.get("skill_id")
            if skill in changed_skills:
                record["v4_status"] = status["delivery_status"]

    package.update({key: status[key] for key in ("delivery_stage", "complete_delivery", "pack_status", "delivery_status", "can_mark_deliverable")})
    package["head"] = pack["head"]
    package["head_short"] = pack["head"][:7]
    package["source_mode"] = source_mode
    package["v4_provenance"] = provenance
    package["v4_changed_skills"] = changed_skills
    if "implemented_skills" in package:
        package["implemented_skills"] = pack.get("implemented_skills", package["implemented_skills"])
    if "all_registered_skills" in package:
        package["all_registered_skills"] = pack.get("all_registered_skills", [])
    if "wind_compatibility" in package and "wind_compatibility" in pack:
        package["wind_compatibility"] = pack["wind_compatibility"]
    if "counts" in package and "counts" in pack:
        package["counts"] = pack["counts"]

    banner = (
        "## v4 双风兼容元数据更新\n\n"
        "本包运行源码未变；仅更新 `wind_compatibility.peer_sha256` 以匹配界风 v4 的 `packs/refreshFeng.js`。"
        "正式验收以交付目录 `ACCEPTANCE.md` 为准。\n\n"
        if args.metadata_only else
        "## v4 扩展候选\n\n"
        f"本包由 v3 封版 ZIP 派生；运行变更：{', '.join(changed_files) or '无'}。"
        "正式验收以交付目录 `ACCEPTANCE.md` 和 `P2-RESOLUTION.md` 为准。\n\n"
    )
    if args.final:
        banner = banner.replace("v4 扩展候选", "v4 内部验收通过").replace("v4 双风兼容元数据更新", "v4 双风兼容元数据更新（已验收）")
    for name in ("README.md", "checklist.md", "COMMANDS.md"):
        if name not in data:
            continue
        old_title, _, content = data[name].decode().partition("\n")
        updated[name] = (old_title + "\n\n" + banner + content.lstrip("\n")).encode()

    updated["pack.json"] = json_bytes(pack)
    if checklist:
        updated["checklist.json"] = json_bytes(checklist)
    manifest["generated_at"] = git("show", "-s", "--format=%cI", head).decode().strip()
    entries = {entry["path"]: entry for entry in manifest["files"]}
    for name, body in updated.items():
        entry = entries.get(name)
        if entry is None:
            if name not in ("manifest.json",):
                raise ValueError(f"Manifest has no entry for {name}")
            continue
        entry.update(size=len(body), sha256=sha256(body))
        if name.startswith("source/"):
            entry.update(commit=head, source_kind="git-blob", repo_path=name[len("source/"):])
        elif name == patch_name:
            entry.update(commit=head, source_kind="generated", repo_path=None)
    updated["manifest.json"] = json_bytes(manifest)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(args.output, "x", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as output:
        for info in infos:
            output.writestr(info, updated.get(info.filename, data[info.filename]))
    print(json.dumps({
        "pack_id": args.pack_id,
        "output": str(args.output),
        "sha256": sha256(args.output.read_bytes()),
        "source_head": head,
        "changed_files": changed_files,
        "peer_sha256": args.peer_sha256 or None,
        "metadata_only": bool(args.metadata_only),
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
