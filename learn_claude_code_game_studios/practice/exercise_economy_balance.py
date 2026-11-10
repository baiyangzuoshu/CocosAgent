#!/usr/bin/env python3
"""Calculate a small economy-flow scenario and read its target via CCGS registry.sh."""

from __future__ import annotations

import argparse
import csv
import re
import shutil
import subprocess
import sys
import tempfile
from decimal import Decimal, InvalidOperation, ROUND_CEILING
from pathlib import Path


DEFAULT_CCGS_ROOT = Path(__file__).resolve().parents[2] / "engine" / "Claude-Code-Game-Studios"
DEFAULT_DATA = Path(__file__).resolve().parent / "fixtures" / "s23_economy_flow.csv"
FORMULA_NAME = "sink_to_source_ratio"


def run_registry(script: Path, root: Path, *args: str):
    result = subprocess.run(
        ["bash", str(script), "--root", str(root), *args],
        cwd=str(root),
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError(
            f"registry.sh exited {result.returncode}: {result.stderr.strip()}\n{result.stdout}"
        )
    return result.stdout


def write_synthetic_registry(root: Path):
    path = root / "design" / "registry" / "entities.yaml"
    path.parent.mkdir(parents=True)
    path.write_text(
        "version: 1\n"
        "entities: []\n"
        "items: []\n"
        "formulas:\n"
        "  - name: sink_to_source_ratio\n"
        "    status: active\n"
        "    source: design/gdd/economy.md\n"
        "    referenced_by:\n"
        "      - design/gdd/economy.md\n"
        "    variables:\n"
        "      - daily_sinks\n"
        "      - daily_faucets\n"
        "    output_range: [0.70, 0.90]\n"
        '    expression: "daily_sinks / daily_faucets"\n'
        "    added: 2026-11-11\n"
        "constants: []\n",
        encoding="utf-8",
    )
    return path


def read_target_range(registry_output: str):
    match = re.search(
        r"^\s*output_range:\s*\[\s*([0-9]+(?:\.[0-9]+)?)\s*,\s*([0-9]+(?:\.[0-9]+)?)\s*\]",
        registry_output,
        re.MULTILINE,
    )
    if not match:
        raise RuntimeError(f"registry entry {FORMULA_NAME!r} has no readable output_range")
    return Decimal(match.group(1)), Decimal(match.group(2))


def load_flows(path: Path):
    totals = {"faucet": Decimal(0), "sink": Decimal(0)}
    units = set()
    with path.open(newline="", encoding="utf-8") as data_file:
        reader = csv.DictReader(data_file)
        expected = {"kind", "name", "amount", "occurrences_per_day", "unit"}
        if not reader.fieldnames or not expected.issubset(reader.fieldnames):
            raise RuntimeError(f"CSV must include columns: {', '.join(sorted(expected))}")
        for line_number, row in enumerate(reader, start=2):
            kind = row["kind"].strip().lower()
            if kind not in totals:
                raise RuntimeError(f"line {line_number}: kind must be faucet or sink")
            try:
                amount = Decimal(row["amount"])
                frequency = Decimal(row["occurrences_per_day"])
            except (InvalidOperation, TypeError):
                raise RuntimeError(f"line {line_number}: amount and occurrences_per_day must be numeric")
            if amount < 0 or frequency < 0:
                raise RuntimeError(f"line {line_number}: amount and frequency cannot be negative")
            totals[kind] += amount * frequency
            units.add(row["unit"].strip())
    if len(units) != 1 or "" in units:
        raise RuntimeError("this exercise requires one non-empty currency unit")
    return totals, units.pop()


def fmt(value: Decimal):
    return f"{value.normalize():f}"


def exercise(ccgs_root: Path, data_path: Path, purchase_cost: Decimal, starting_balance: Decimal):
    ccgs_root = ccgs_root.expanduser().resolve()
    data_path = data_path.expanduser().resolve()
    helper_source = ccgs_root / ".claude" / "scripts" / "registry.sh"
    if not helper_source.is_file():
        raise RuntimeError(f"missing CCGS helper: {helper_source}")

    with tempfile.TemporaryDirectory(prefix="ccgs-economy-balance-") as temporary:
        root = Path(temporary)
        helper = root / ".claude" / "scripts" / "registry.sh"
        helper.parent.mkdir(parents=True)
        shutil.copy2(helper_source, helper)
        write_synthetic_registry(root)

        registry_output = run_registry(helper, root, "get", FORMULA_NAME)
        low, high = read_target_range(registry_output)
        totals, unit = load_flows(data_path)

    faucets, sinks = totals["faucet"], totals["sink"]
    net = faucets - sinks
    ratio = sinks / faucets if faucets else None
    required = max(Decimal(0), purchase_cost - starting_balance)
    days = (required / net).to_integral_value(rounding=ROUND_CEILING) if net > 0 else None

    print("CCGS economy balance exercise (synthetic project, temporary directory)")
    print("The target is read with the real CCGS registry.sh; flow arithmetic is the lesson-side model.\n")
    print(f"registry.sh get {FORMULA_NAME}:")
    for line in registry_output.splitlines():
        if line.startswith("ENTRY\t") or line.strip().startswith("output_range:") or line.strip().startswith("expression:"):
            print("  " + line)
    print("\nScenario:")
    print(f"  currency: {unit}")
    print(f"  daily faucets: {fmt(faucets)} {unit}/day")
    print(f"  daily sinks: {fmt(sinks)} {unit}/day")
    print(f"  daily net: {fmt(net)} {unit}/day")
    if ratio is None:
        print("  sink/source ratio: NOT ASSESSED (daily faucets are zero)")
    else:
        print(f"  sink/source ratio: {fmt(ratio)} (registered range {fmt(low)}–{fmt(high)})")
        relation = "within range" if low <= ratio <= high else ("below range" if ratio < low else "above range")
        print(f"  target comparison: {relation}; this is one signal, not the complete balance verdict")
    if days is None:
        print(f"  days to afford {fmt(purchase_cost)} {unit} from {fmt(starting_balance)}: not reachable under this net-flow scenario")
    else:
        print(f"  days to afford {fmt(purchase_cost)} {unit} from {fmt(starting_balance)}: {int(days)}")
    print("\nModel limit: fixed daily rates only; no player distribution, random drops, finite sink stock, or behavioral feedback.")


def decimal_arg(value: str):
    try:
        number = Decimal(value)
    except InvalidOperation:
        raise argparse.ArgumentTypeError("must be a number")
    if number < 0:
        raise argparse.ArgumentTypeError("cannot be negative")
    return number


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ccgs-root", type=Path, default=DEFAULT_CCGS_ROOT)
    parser.add_argument("--data", type=Path, default=DEFAULT_DATA, help="CSV faucet/sink scenario")
    parser.add_argument("--purchase-cost", type=decimal_arg, default=Decimal("200"))
    parser.add_argument("--starting-balance", type=decimal_arg, default=Decimal("50"))
    args = parser.parse_args()
    try:
        exercise(args.ccgs_root, args.data, args.purchase_cost, args.starting_balance)
    except (OSError, RuntimeError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
