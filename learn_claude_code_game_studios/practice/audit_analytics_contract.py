#!/usr/bin/env python3
"""Audit a synthetic event/experiment contract for the CCGS analytics lesson."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path


DEFAULT_FIXTURES = Path(__file__).resolve().parent / "fixtures"
EVENT_NAME = re.compile(r"^[a-z0-9_]+\.[a-z0-9_]+\.[a-z0-9_]+$")
POTENTIAL_DIRECT_IDENTIFIERS = {"email", "email_address", "phone", "phone_number", "real_name", "full_name", "ip_address", "street_address"}


def load_contract(path: Path):
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise RuntimeError(f"cannot read contract {path}: {error}") from error
    if not isinstance(data, dict):
        raise RuntimeError("contract root must be a JSON object")
    return data


def load_events(path: Path):
    events = []
    try:
        for line_number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
            if not line.strip():
                continue
            try:
                event = json.loads(line)
            except json.JSONDecodeError as error:
                raise RuntimeError(f"invalid event on line {line_number}: {error}") from error
            if not isinstance(event, dict):
                raise RuntimeError(f"event on line {line_number} must be an object")
            events.append((line_number, event))
    except OSError as error:
        raise RuntimeError(f"cannot read sample events {path}: {error}") from error
    return events


def valid_window(experiment):
    start = experiment.get("start_day")
    end = experiment.get("end_day")
    return isinstance(start, int) and isinstance(end, int) and start <= end


def overlaps(left, right):
    return left["start_day"] <= right["end_day"] and right["start_day"] <= left["end_day"]


def audit(contract, sample_events):
    findings = []
    definitions = contract.get("events", [])
    defined = {}
    for index, item in enumerate(definitions, start=1):
        if not isinstance(item, dict):
            findings.append(f"ERROR event definition #{index} is not an object")
            continue
        name = str(item.get("name", ""))
        if not EVENT_NAME.fullmatch(name):
            findings.append(f"ERROR event name {name!r} does not match three-part dot naming")
        if name in defined:
            findings.append(f"ERROR duplicate event definition {name}")
        defined[name] = item
        for field in ("purpose", "fire_condition"):
            if not isinstance(item.get(field), str) or not item[field].strip():
                findings.append(f"ERROR {name or f'event #{index}'} has no {field}")
        required = item.get("required_properties", [])
        if not isinstance(required, list) or not all(isinstance(prop, str) for prop in required):
            findings.append(f"ERROR {name or f'event #{index}'} required_properties must be a string list")

    known_events = len(defined)
    seen_events = set()
    for line_number, event in sample_events:
        name = event.get("event_name")
        if name not in defined:
            findings.append(f"ERROR sample line {line_number}: event {name!r} is not defined")
            continue
        seen_events.add(name)
        properties = event.get("properties", {})
        if not isinstance(properties, dict):
            findings.append(f"ERROR sample line {line_number}: properties must be an object")
            continue
        expected = set(defined[name].get("required_properties", []))
        missing = sorted(expected - properties.keys())
        extra = sorted(properties.keys() - expected)
        if missing:
            findings.append(f"ERROR sample line {line_number} {name}: missing required properties {', '.join(missing)}")
        if extra:
            findings.append(f"REVIEW sample line {line_number} {name}: properties not listed in contract {', '.join(extra)}")
        sensitive = sorted(set(properties) & POTENTIAL_DIRECT_IDENTIFIERS)
        if sensitive:
            findings.append(f"PRIVACY REVIEW sample line {line_number} {name}: potential direct identifier field(s) {', '.join(sensitive)}")

    missing_events = sorted(set(defined) - seen_events)
    if missing_events:
        findings.append("OBSERVATION no sample rows for defined event(s): " + ", ".join(missing_events))

    privacy = contract.get("privacy", {})
    for field in ("consent_rule", "retention_rule"):
        value = privacy.get(field) if isinstance(privacy, dict) else None
        if not isinstance(value, str) or not value.strip() or value.strip().upper() == "TBD":
            findings.append(f"NOT ASSESSED privacy.{field} is unresolved; ask the project owner")

    experiments = contract.get("experiments", [])
    for index, item in enumerate(experiments, start=1):
        if not isinstance(item, dict):
            findings.append(f"ERROR experiment #{index} is not an object")
            continue
        name = item.get("name", f"experiment #{index}")
        required = ("hypothesis", "target_segment", "primary_metric")
        for field in required:
            if not isinstance(item.get(field), str) or not item[field].strip():
                findings.append(f"ERROR {name} has no {field}")
        if item.get("assignment_unit") != "player":
            findings.append(f"ERROR {name} assignment_unit must be player for stable per-player assignment")
        if item.get("stable_across_sessions") is not True:
            findings.append(f"ERROR {name} variant assignment is not declared stable across sessions")
        for field in ("minimum_sample_size", "minimum_run_days"):
            value = item.get(field)
            if not isinstance(value, int) or value <= 0:
                findings.append(f"ERROR {name} needs a positive {field}")
        if not valid_window(item):
            findings.append(f"ERROR {name} needs a valid start_day/end_day window")

    valid_experiments = [item for item in experiments if isinstance(item, dict) and valid_window(item)]
    for index, left in enumerate(valid_experiments):
        for right in valid_experiments[index + 1 :]:
            if left.get("target_segment") == right.get("target_segment") and overlaps(left, right):
                first = max(left["start_day"], right["start_day"])
                last = min(left["end_day"], right["end_day"])
                findings.append(
                    f"EXPERIMENT OVERLAP {left.get('name')} + {right.get('name')}: "
                    f"segment {left.get('target_segment')} on days {first}-{last}; "
                    "sequence tests, split exclusive segments, or use a larger factorial design if interaction matters"
                )
    return known_events, len(experiments), findings


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--contract", type=Path, default=DEFAULT_FIXTURES / "s25_analytics_contract.json")
    parser.add_argument("--events", type=Path, default=DEFAULT_FIXTURES / "s25_sample_events.ndjson")
    args = parser.parse_args()
    try:
        contract = load_contract(args.contract.expanduser().resolve())
        sample_events = load_events(args.events.expanduser().resolve())
        event_count, experiment_count, findings = audit(contract, sample_events)
    except (OSError, RuntimeError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 1
    print("CCGS analytics contract exercise (synthetic event specification and logs)")
    print(f"Defined events: {event_count}; sample rows: {len(sample_events)}; experiments: {experiment_count}")
    print("The checker is course-authored; findings require owner review and are not compliance verdicts.\n")
    for finding in findings:
        print("- " + finding)
    print(f"\nFindings: {len(findings)} (review observations, not a pass/fail rating)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
