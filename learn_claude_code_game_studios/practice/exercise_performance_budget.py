#!/usr/bin/env python3
"""Compare synthetic performance samples with budgets resolved by CCGS."""

from __future__ import annotations

import argparse
import csv
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


DEFAULT_CCGS_ROOT = Path(__file__).resolve().parents[2] / "engine" / "Claude-Code-Game-Studios"
DEFAULT_FIXTURES = Path(__file__).resolve().parent / "fixtures" / "s27_performance_budget"
METRICS = (
    ("FPS", "performance.target_framerate", "fps", "min"),
    ("Frame time (ms)", "performance.frame_budget_ms", "frame_ms", "max"),
    ("Draw calls", "performance.draw_call_limit", "draw_calls", "max"),
    ("Memory (MB)", "performance.memory_ceiling_mb", "memory_mb", "max"),
)


def run_helper(helper: Path, project_root: Path, *arguments: str) -> str:
    result = subprocess.run(
        ["bash", str(helper), *arguments],
        cwd=project_root,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError(f"yaml-helper.sh {' '.join(arguments)} failed: {result.stderr.strip()}")
    return result.stdout.strip()


def read_samples(path: Path) -> dict[str, dict[str, str]]:
    with path.open(newline="", encoding="utf-8") as stream:
        rows = {row["scenario"]: row for row in csv.DictReader(stream)}
    if not rows:
        raise RuntimeError(f"no observations found in {path}")
    return rows


def resolve_enforcement(helper: Path, project_root: Path) -> tuple[str, str]:
    output = run_helper(helper, project_root, "resolve_config", "--keys", "performance.enforce")
    match = re.search(r"^performance\.enforce:\s*(\S+)\s+\(([^)]+)\)", output, re.MULTILINE)
    if not match:
        raise RuntimeError(f"could not parse resolved performance.enforce from: {output!r}")
    value, source = match.groups()
    if value not in {"warn", "block", "off"}:
        raise RuntimeError(f"unexpected enforcement value from CCGS helper: {value}")
    return value, source


def classify(actual: float, budget: float | None, direction: str) -> str:
    if budget is None:
        return "NOT ASSESSED"
    breached = actual < budget if direction == "min" else actual > budget
    return "OVER" if breached else "OK"


def read_number(helper: Path, project_root: Path, key: str) -> float | None:
    value = run_helper(helper, project_root, "get_effective_yaml_key", key)
    if not value:
        return None
    try:
        return float(value)
    except ValueError as error:
        raise RuntimeError(f"{key} is not numeric: {value!r}") from error


def exercise(ccgs_root: Path, fixtures: Path) -> None:
    ccgs_root = ccgs_root.expanduser().resolve()
    fixtures = fixtures.expanduser().resolve()
    source_helper = ccgs_root / ".claude" / "hooks" / "yaml-helper.sh"
    if not source_helper.is_file():
        raise RuntimeError(f"missing CCGS helper: {source_helper}")

    samples = read_samples(fixtures / "profile_samples.csv")
    scenarios = sorted(path for path in fixtures.iterdir() if path.is_dir())
    if not scenarios:
        raise RuntimeError(f"no project fixtures found in {fixtures}")

    observations = []
    with tempfile.TemporaryDirectory(prefix="ccgs-performance-budget-") as temporary:
        sandbox = Path(temporary)
        for scenario in scenarios:
            project_yaml = scenario / "project.yaml"
            sample = samples.get(scenario.name)
            if not project_yaml.is_file():
                raise RuntimeError(f"missing project.yaml in {scenario}")
            if sample is None:
                raise RuntimeError(f"missing profile sample for {scenario.name}")

            project_root = sandbox / scenario.name
            hooks = project_root / ".claude" / "hooks"
            hooks.mkdir(parents=True)
            helper = hooks / "yaml-helper.sh"
            shutil.copy2(source_helper, helper)
            shutil.copy2(project_yaml, project_root / "project.yaml")
            local_yaml = scenario / "project.local.yaml"
            if local_yaml.is_file():
                shutil.copy2(local_yaml, project_root / "project.local.yaml")

            budgets = {
                label: read_number(helper, project_root, key)
                for label, key, _, _ in METRICS
            }
            enforcement, source = resolve_enforcement(helper, project_root)
            statuses = {
                label: classify(float(sample[column]), budgets[label], direction)
                for label, _, column, direction in METRICS
            }
            observations.append((scenario.name, sample, budgets, statuses, enforcement, source))

    print("CCGS performance budget exercise (synthetic observation samples)")
    print("Uses the real CCGS yaml-helper.sh; only temporary config copies are read.\n")
    for name, sample, budgets, statuses, enforcement, source in observations:
        breaches = [metric for metric, state in statuses.items() if state == "OVER"]
        unassessed = [metric for metric, state in statuses.items() if state == "NOT ASSESSED"]
        print(f"## {name}")
        print(f"  performance.enforce: {enforcement} ({source})")
        for label, key, column, _ in METRICS:
            budget = budgets[label]
            budget_text = "(unset)" if budget is None else f"{budget:g}"
            print(
                f"  {label}: observed {sample[column]}, budget {budget_text}"
                f" -> {statuses[label]}"
            )
        if unassessed:
            print(f"  Missing budgets: {', '.join(unassessed)}; no headroom or pass can be claimed.")
        if enforcement == "off":
            print("  Decision: budgets are informational; breaches are not findings or gate verdicts.")
        elif breaches and enforcement == "block":
            print("  Decision: budget breaches block CI; Polish Gate may FAIL on these blockers.")
        elif breaches:
            print("  Decision: report findings; the Polish Gate surfaces CONCERNS, not blockers.")
        elif unassessed:
            print("  Decision: NOT ASSESSED; missing budgets prevent a clean performance verdict.")
        else:
            print("  Decision: no sample breach under the configured budgets.")
        print()
    print("These values are synthetic exercise data, not game or target-device measurements.")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ccgs-root", type=Path, default=DEFAULT_CCGS_ROOT)
    parser.add_argument("--fixtures", type=Path, default=DEFAULT_FIXTURES)
    args = parser.parse_args()
    try:
        exercise(args.ccgs_root, args.fixtures)
    except (OSError, RuntimeError, KeyError, ValueError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
