#!/usr/bin/env python3
"""Run the real CCGS YAML helper against synthetic security-scope fixtures."""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


DEFAULT_CCGS_ROOT = Path(__file__).resolve().parents[2] / "engine" / "Claude-Code-Game-Studios"
DEFAULT_FIXTURES = Path(__file__).resolve().parent / "fixtures" / "s26_security_scope"


def read_setting(helper: Path, project_root: Path, key: str):
    result = subprocess.run(
        ["bash", str(helper), "get_yaml_key", "project.yaml", key],
        cwd=str(project_root),
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError(f"yaml-helper.sh failed for {key}: {result.stderr.strip()}")
    value = result.stdout.strip()
    return value if value else None


def network_scope(online, multiplayer):
    if online == "false" and multiplayer == "false":
        return "Category 2 can be skipped as explicitly out of scope; record both false values."
    if online is None or multiplayer is None:
        return "Do not skip Category 2; ask the user, or run it and mark scope NOT ASSESSED if unanswered."
    if online == "true" or multiplayer == "true":
        return "Category 2 is in scope and must run."
    return "Values are not recognized booleans; do not skip Category 2 and resolve the project scope."


def save_pattern_status(engine):
    if engine == "godot":
        return "Godot save patterns are available in the Skill; verify names against the pinned engine version."
    if engine in {"unity", "unreal"}:
        return "Category 1 is NOT ASSESSED: this snapshot has no sourced save/serialization pattern set."
    return "Code pattern categories are NOT ASSESSED until engine.name is resolved."


def exercise(ccgs_root: Path, fixtures: Path):
    ccgs_root = ccgs_root.expanduser().resolve()
    fixtures = fixtures.expanduser().resolve()
    source = ccgs_root / ".claude" / "hooks" / "yaml-helper.sh"
    if not source.is_file():
        raise RuntimeError(f"missing CCGS helper: {source}")
    config_files = sorted(fixtures.glob("*.yaml"))
    if not config_files:
        raise RuntimeError(f"no YAML fixtures found in {fixtures}")

    observations = []
    with tempfile.TemporaryDirectory(prefix="ccgs-security-scope-") as temporary:
        sandbox = Path(temporary)
        for config in config_files:
            project_root = sandbox / config.stem
            hooks = project_root / ".claude" / "hooks"
            hooks.mkdir(parents=True)
            helper = hooks / "yaml-helper.sh"
            shutil.copy2(source, helper)
            shutil.copy2(config, project_root / "project.yaml")
            values = {key: read_setting(helper, project_root, key) for key in (
                "engine.name", "platform.online", "platform.multiplayer"
            )}
            observations.append((config.name, values))

    print("CCGS security audit scope exercise (synthetic project configuration)")
    print("Using the real CCGS yaml-helper.sh; only temporary project copies are read.\n")
    for filename, values in observations:
        engine = values["engine.name"]
        online = values["platform.online"]
        multiplayer = values["platform.multiplayer"]
        print(f"## {filename}")
        print(f"  engine.name: {engine or '(unset)'}")
        print(f"  platform.online: {online or '(unset)'}")
        print(f"  platform.multiplayer: {multiplayer or '(unset)'}")
        print("  " + network_scope(online, multiplayer))
        print("  " + save_pattern_status(engine))
        if engine in {"unity", "unreal"}:
            print("  Full-audit implication: Category 1 NOT ASSESSED blocks CLEAR TO SHIP.")
        print()
    print("Scope observations only: no source code, dependencies, or live game were scanned.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ccgs-root", type=Path, default=DEFAULT_CCGS_ROOT)
    parser.add_argument("--fixtures", type=Path, default=DEFAULT_FIXTURES)
    args = parser.parse_args()
    try:
        exercise(args.ccgs_root, args.fixtures)
    except (OSError, RuntimeError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
