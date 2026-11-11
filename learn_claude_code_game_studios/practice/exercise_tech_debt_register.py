#!/usr/bin/env python3
"""Run the real CCGS debt-register helpers against a synthetic register."""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


DEFAULT_REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_CCGS_ROOT = DEFAULT_REPO_ROOT / "engine" / "Claude-Code-Game-Studios"
DEFAULT_FIXTURE = (
    Path(__file__).resolve().parent
    / "fixtures"
    / "s30_technical_debt"
    / "tech-debt-register.md"
)


def run_helper(script: Path, root: Path, *args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["bash", str(script), "--root", str(root), *args],
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )


def parse_rows(output: str) -> list[list[str]]:
    return [line.split("\t") for line in output.splitlines() if line]


def require_row(rows: list[list[str]], *fields: str) -> list[str]:
    expected = list(fields)
    for row in rows:
        if row == expected:
            return row
    raise RuntimeError(f"missing expected helper row: {' | '.join(expected)}")


def show(title: str, output: str) -> None:
    print(title)
    for row in parse_rows(output):
        print("  " + " | ".join(row))


def exercise(ccgs_root: Path, fixture: Path) -> None:
    ccgs_root = ccgs_root.expanduser().resolve()
    fixture = fixture.expanduser().resolve()
    helper = ccgs_root / ".claude" / "scripts" / "debt-register.sh"
    if not helper.is_file():
        raise RuntimeError(f"missing CCGS debt register helper: {helper}")
    if not fixture.is_file():
        raise RuntimeError(f"missing register fixture: {fixture}")

    with tempfile.TemporaryDirectory(prefix="ccgs-tech-debt-") as temporary:
        project = Path(temporary) / "project"
        docs = project / "docs"
        docs.mkdir(parents=True)
        register = docs / "tech-debt-register.md"
        shutil.copyfile(fixture, register)
        original = register.read_bytes()

        score = run_helper(helper, project, "score")
        if score.returncode != 0:
            raise RuntimeError(f"score exited {score.returncode}: {score.stderr.strip()}\n{score.stdout}")
        score_rows = parse_rows(score.stdout)
        require_row(score_rows, "scored", "4")
        require_row(score_rows, "not_scored", "1")
        require_row(score_rows, "open_ranked", "3")
        ordered_ids = [row[2] for row in score_rows if row[0] == "ROW"]
        if ordered_ids != ["TD-001", "TD-005", "TD-002", "TD-004", "TD-003"]:
            raise RuntimeError(f"unexpected score order: {ordered_ids}")
        require_row(score_rows, "ROW", "1", "TD-001", "3.0", "High", "S", "-", "2026-10-01", "OPEN", "-")
        require_row(score_rows, "ROW", "2", "TD-005", "1.3", "Critical", "L", "-", "2026-11-05", "OPEN", "-")
        require_row(score_rows, "ROW", "3", "TD-002", "1.3", "Critical", "L", "-", "2026-11-10", "OPEN", "-")
        require_row(score_rows, "ROW", "-", "TD-003", "-", "Med", "-", "-", "2026-11-11", "OPEN", "effort not judged")
        show("## score: impact / effort ranking", score.stdout)

        stats = run_helper(
            helper,
            project,
            "--today",
            "2026-11-11",
            "--since",
            "2026-11-01",
            "--until",
            "2026-11-11",
            "--older-than",
            "30",
            "stats",
        )
        if stats.returncode != 0:
            raise RuntimeError(f"stats exited {stats.returncode}: {stats.stderr.strip()}\n{stats.stdout}")
        stats_rows = parse_rows(stats.stdout)
        require_row(stats_rows, "open", "4")
        require_row(stats_rows, "resolved", "1")
        require_row(stats_rows, "added_in_window", "4")
        require_row(stats_rows, "resolved_in_window", "1")
        require_row(stats_rows, "net_in_window", "3")
        require_row(stats_rows, "older_than", "30", "1")
        require_row(stats_rows, "OPEN", "TD-001", "Code Quality", "S", "High", "-", "2026-10-01", "41", "Backlog", "yes")
        show("\n## stats: window totals and open-item ages", stats.stdout)

        match = run_helper(helper, project, "--file", "./src/world.gd", "--category", "Performance", "match")
        if match.returncode != 0:
            raise RuntimeError(f"match exited {match.returncode}: {match.stderr.strip()}\n{match.stdout}")
        match_rows = parse_rows(match.stdout)
        require_row(match_rows, "matches", "1", "file=src/world.gd category=Performance")
        require_row(match_rows, "MATCH", "TD-002", "8", "Performance", "Open", "src/world.gd")
        show("\n## match: find an existing Open item before adding", match.stdout)

        next_id = run_helper(helper, project, "next-id")
        if next_id.returncode != 0:
            raise RuntimeError(f"next-id exited {next_id.returncode}: {next_id.stderr.strip()}\n{next_id.stdout}")
        next_rows = parse_rows(next_id.stdout)
        require_row(next_rows, "next", "td", "-", "TD-006", "TD-005", "5")
        show("\n## next-id: continue after the highest ID", next_id.stdout)

        if register.read_bytes() != original:
            raise RuntimeError("the read-only helper changed the temporary register")

    print("\nAll helper calls ran against a temporary synthetic project; the register was unchanged.")
    print("The helper reports observations only; it does not generate the /tech-debt Skill verdict or approve writes.")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ccgs-root", type=Path, default=DEFAULT_CCGS_ROOT)
    parser.add_argument("--fixture", type=Path, default=DEFAULT_FIXTURE)
    args = parser.parse_args()
    try:
        exercise(args.ccgs_root, args.fixture)
    except (OSError, RuntimeError, ValueError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
