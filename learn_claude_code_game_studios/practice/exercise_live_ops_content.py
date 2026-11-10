#!/usr/bin/env python3
"""Run CCGS content-count helpers on isolated, synthetic Godot projects."""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


DEFAULT_CCGS_ROOT = Path(__file__).resolve().parents[2] / "engine" / "Claude-Code-Game-Studios"
HELPERS = ("content-count.sh", "registry.sh")


def rows(output: str):
    return [line.split("\t") for line in output.splitlines() if line]


def row_value(output_rows, key: str, field: int = 2) -> str:
    for row in output_rows:
        if row[0] == key:
            return row[field]
    raise RuntimeError(f"CCGS helper output is missing the {key!r} row")


def copy_helpers(ccgs_root: Path, project: Path):
    scripts = project / ".claude" / "scripts"
    scripts.mkdir(parents=True)
    copied = {}
    for name in HELPERS:
        source = ccgs_root / ".claude" / "scripts" / name
        if not source.is_file():
            raise RuntimeError(f"missing CCGS helper: {source}")
        target = scripts / name
        shutil.copy2(source, target)
        copied[name] = target
    return copied


def run_helper(script: Path, root: Path, *args: str, input_text: str | None = None):
    result = subprocess.run(
        ["bash", str(script), "--root", str(root), *args],
        cwd=str(root),
        input=input_text,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    return result


def require_success(result: subprocess.CompletedProcess, script: Path):
    if result.returncode != 0:
        raise RuntimeError(
            f"{script.name} exited {result.returncode}: {result.stderr.strip()}\n{result.stdout}"
        )


def create_project(project: Path):
    project.mkdir(parents=True)
    registry = project / "design" / "registry" / "entities.yaml"
    registry.parent.mkdir(parents=True)
    registry.write_text(
        "version: 1\n"
        "entities:\n"
        "  - name: ember-warden\n"
        "    status: active\n"
        "    source: design/gdd/combat.md\n"
        "  - name: tide-witch\n"
        "    status: active\n"
        "    source: design/gdd/combat.md\n"
        "  - name: cloud-moth\n"
        "    status: active\n"
        "    source: design/gdd/combat.md\n"
        "  - name: retired-guardian\n"
        "    status: deprecated\n"
        "    source: design/gdd/combat.md\n"
        "items:\n"
        "  - name: harbor-tonic\n"
        "    status: active\n"
        "    source: design/gdd/inventory.md\n"
        "  - name: storm-charm\n"
        "    status: active\n"
        "    source: design/gdd/inventory.md\n"
        "  - name: old-token\n"
        "    status: deprecated\n"
        "    source: design/gdd/inventory.md\n",
        encoding="utf-8",
    )

    files = (
        "assets/data/characters/ember-warden.tres",
        "assets/data/items/harbor-tonic.json",
        "assets/levels/harbor.tscn",
        "assets/levels/cavern.tscn",
    )
    for relative in files:
        path = project / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text("# synthetic fixture\n", encoding="utf-8")


def summarize_project(project: Path, copied):
    plan_result = run_helper(copied["content-count.sh"], project, "registry")
    require_success(plan_result, copied["content-count.sh"])
    plan = rows(plan_result.stdout)
    # `planned` is emitted twice, once for each registry section.
    plan_entities = next(int(row[2]) for row in plan if row[0:2] == ["planned", "entities"])
    plan_items = next(int(row[2]) for row in plan if row[0:2] == ["planned", "items"])
    skipped = int(row_value(plan, "deprecated_skipped", 1))
    if (plan_entities, plan_items, skipped) != (3, 2, 2):
        raise RuntimeError("registry fixture should have 3 active entities, 2 active items, and 2 deprecated entries")

    found_result = run_helper(copied["content-count.sh"], project, "--engine", "godot", "found")
    require_success(found_result, copied["content-count.sh"])
    found = rows(found_result.stdout)
    counts = {row[1]: int(row[2]) for row in found if row[0] == "found"}
    expected = {"characters": 1, "items": 1, "levels": 2}
    if any(counts.get(key) != value for key, value in expected.items()):
        raise RuntimeError(f"unexpected fixture file counts: {counts}")

    gap_input = (
        f"combat\tcharacters\t{plan_entities}\t{counts['characters']}\n"
        f"economy\titems\t{plan_items}\t{counts['items']}\n"
        f"world\tlevels\t4\t{counts['levels']}\n"
    )
    gap_result = run_helper(copied["content-count.sh"], project, "gap", input_text=gap_input)
    require_success(gap_result, copied["content-count.sh"])

    print("## Synthetic project with plan and files")
    print("content-count registry:")
    for row in plan:
        if row[0] in {"planned", "planned_total", "deprecated_skipped", "PLANNED", "SKIPPED"}:
            print("  " + "\t".join(row))
    print("\ncontent-count found --engine godot:")
    for row in found:
        if row[0] in {"engine", "root", "found"}:
            print("  " + "\t".join(row))
    print("\ncontent-count gap (the lesson supplies planned level count 4):")
    for row in rows(gap_result.stdout):
        if row[0] in {"total_specified", "total_found", "total_gap", "gap_pct", "unbuilt", "ROW"}:
            print("  " + "\t".join(row))


def summarize_empty_project(project: Path, copied):
    result = run_helper(copied["content-count.sh"], project, "--engine", "godot", "found")
    if result.returncode != 4:
        raise RuntimeError(f"empty project should report no scannable roots (exit 4), got {result.returncode}")
    print("\n## Empty project")
    for row in rows(result.stdout):
        if row[0] in {"engine", "root"}:
            print("  " + "\t".join(row))
    print(f"  helper exit: {result.returncode} (no content roots; NOT ASSESSED, not a clean zero-count audit)")


def summarize_bands(script: Path, root: Path):
    print("\n## Coverage band boundaries")
    for found, specified in ((0, 3), (1, 3), (2, 4), (4, 4)):
        result = run_helper(script, root, "band", str(found), str(specified))
        require_success(result, script)
        print("  " + "\t".join(rows(result.stdout)[0]))


def exercise(ccgs_root: Path) -> int:
    ccgs_root = ccgs_root.expanduser().resolve()
    with tempfile.TemporaryDirectory(prefix="ccgs-live-ops-content-") as temporary:
        work = Path(temporary)
        project = work / "known-project"
        empty = work / "empty-project"
        create_project(project)
        project_helpers = copy_helpers(ccgs_root, project)
        empty_helpers = copy_helpers(ccgs_root, empty)

        print("CCGS live-ops content audit exercise (synthetic projects in a temporary directory)")
        print("Using the real CCGS content-count.sh and registry.sh; only temporary fixtures are written.\n")
        summarize_project(project, project_helpers)
        summarize_empty_project(empty, empty_helpers)
        summarize_bands(project_helpers["content-count.sh"], project)
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--ccgs-root",
        type=Path,
        default=DEFAULT_CCGS_ROOT,
        help="CCGS source snapshot (defaults to engine/Claude-Code-Game-Studios)",
    )
    args = parser.parse_args()
    try:
        return exercise(args.ccgs_root)
    except (OSError, RuntimeError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
