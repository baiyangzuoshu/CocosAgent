#!/usr/bin/env python3
"""Exercise the CCGS release guard in a disposable, offline Git repository."""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Optional


DEFAULT_CCGS_ROOT = Path(__file__).resolve().parents[2] / "engine" / "Claude-Code-Game-Studios"


def run(command, cwd: Path, *, data: Optional[str] = None, env=None):
    return subprocess.run(
        command,
        cwd=str(cwd),
        input=data,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        env=env,
        check=False,
    )


def isolated_git_environment():
    environment = os.environ.copy()
    for name in tuple(environment):
        if name.startswith("GIT_"):
            environment.pop(name)
    environment["GIT_CONFIG_NOSYSTEM"] = "1"
    return environment


def git(cwd: Path, *args: str, env=None) -> str:
    result = run(["git", *args], cwd, env=env)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or f"git {' '.join(args)} failed")
    return result.stdout.strip()


def find_hook_registration(settings_path: Path):
    try:
        settings = json.loads(settings_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise RuntimeError(f"cannot read CCGS settings.json: {error}") from error

    matches = []
    for entry in settings.get("hooks", {}).get("PreToolUse", []):
        matcher = entry.get("matcher", "")
        if "Bash" not in matcher.split("|"):
            continue
        for hook in entry.get("hooks", []):
            command = hook.get("command", "")
            if ".claude/hooks/validate-push.sh" in command:
                matches.append((matcher, hook.get("timeout"), command))
    if not matches:
        raise RuntimeError("settings.json has no Bash PreToolUse registration for validate-push.sh")
    return matches[0]


def exercise(ccgs_root: Path) -> int:
    ccgs_root = ccgs_root.expanduser().resolve()
    hook_source = ccgs_root / ".claude" / "hooks" / "validate-push.sh"
    guard_source = ccgs_root / ".claude" / "scripts" / "write-guard.sh"
    settings_path = ccgs_root / ".claude" / "settings.json"
    for path in (hook_source, guard_source, settings_path):
        if not path.is_file():
            raise RuntimeError(f"missing CCGS source file: {path}")

    matcher, timeout, registered_command = find_hook_registration(settings_path)
    print("CCGS release guard exercise (temporary Git repo; no release command is run)")
    print(f"settings: PreToolUse matcher={matcher!r}, timeout={timeout}")
    print(f"registration: {registered_command}")

    with tempfile.TemporaryDirectory(prefix="ccgs-release-guard-") as temporary:
        project = Path(temporary)
        environment = isolated_git_environment()
        hooks_dir = project / ".claude" / "hooks"
        scripts_dir = project / ".claude" / "scripts"
        hooks_dir.mkdir(parents=True)
        scripts_dir.mkdir(parents=True)
        fixture_hooks_dir = project / ".fixture-hooks"
        fixture_hooks_dir.mkdir()
        shutil.copy2(hook_source, hooks_dir / hook_source.name)
        shutil.copy2(guard_source, scripts_dir / guard_source.name)

        git(project, "init", "-q", env=environment)
        git(project, "symbolic-ref", "HEAD", "refs/heads/feature/course-demo", env=environment)
        git(project, "config", "user.name", "CCGS lesson fixture", env=environment)
        git(project, "config", "user.email", "ccgs-lesson@example.invalid", env=environment)
        git(project, "config", "commit.gpgSign", "false", env=environment)
        git(project, "config", "core.hooksPath", str(fixture_hooks_dir), env=environment)
        git(project, "add", ".claude/hooks/validate-push.sh", ".claude/scripts/write-guard.sh", env=environment)
        git(project, "commit", "-m", "temporary CCGS guard fixture", env=environment)
        starting_head = git(project, "rev-parse", "HEAD", env=environment)
        environment["CLAUDE_PROJECT_DIR"] = str(project)

        cases = (
            ("push to protected main", "git push origin main", "protected branch 'main'"),
            ("push to feature branch", "git push origin feature/course-demo", None),
            ("list existing tags", "git tag --list", None),
            ("create release tag", "git tag v1.2.1", "This command runs git tag"),
            ("abort a merge", "git merge --abort", None),
            ("merge hotfix", "git merge hotfix/fix-crash", "This command runs git merge"),
        )

        for label, command, expected in cases:
            payload = json.dumps(
                {"tool_name": "Bash", "tool_input": {"command": command}},
                ensure_ascii=False,
            )
            result = run(
                ["bash", str(hooks_dir / "validate-push.sh")],
                project,
                data=payload,
                env=environment,
            )
            if result.returncode != 0:
                raise RuntimeError(f"{label}: hook exited {result.returncode}: {result.stderr.strip()}")

            try:
                hook_output = json.loads(result.stdout) if result.stdout.strip() else {}
            except json.JSONDecodeError as error:
                raise RuntimeError(f"{label}: hook did not return valid JSON: {result.stdout!r}") from error
            message = hook_output.get("systemMessage", "")
            if expected and expected not in message:
                raise RuntimeError(f"{label}: expected {expected!r} in warning, got {message!r}")
            if expected is None and message:
                raise RuntimeError(f"{label}: unexpected warning: {message}")

            status = f"warning: {message}" if message else "no warning"
            print(f"{label}: exit={result.returncode}; {status}")

        if git(project, "branch", "--show-current", env=environment) != "feature/course-demo":
            raise RuntimeError("the fixture branch unexpectedly changed")
        if git(project, "tag", "--list", env=environment):
            raise RuntimeError("a tag was unexpectedly created")
        if git(project, "rev-parse", "HEAD", env=environment) != starting_head:
            raise RuntimeError("the fixture HEAD unexpectedly changed")
        if git(project, "status", "--porcelain", env=environment):
            raise RuntimeError("the disposable fixture repository has unexpected changes")

    print("Verified: payload commands were only passed to the hook; the fixture created no release tag or merge.")
    print("The hook's exit 0 is a warning/allow result; Claude Code's normal permission flow still applies.")
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
