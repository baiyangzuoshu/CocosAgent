#!/usr/bin/env python3
"""Run CCGS asset-scan.sh on generated, temporary Godot project fixtures."""

from __future__ import annotations

import argparse
import re
import shutil
import struct
import subprocess
import sys
import tempfile
import zlib
from pathlib import Path


DEFAULT_REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_CCGS_ROOT = DEFAULT_REPO_ROOT / "engine" / "Claude-Code-Game-Studios"
DEFAULT_FIXTURES = Path(__file__).resolve().parent / "fixtures" / "s28_asset_audit"
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"


def png_chunk(kind: bytes, payload: bytes) -> bytes:
    crc = zlib.crc32(kind + payload) & 0xFFFFFFFF
    return struct.pack(">I", len(payload)) + kind + payload + struct.pack(">I", crc)


def make_png(width: int, height: int, seed: int) -> bytes:
    state = seed & 0xFFFFFFFF
    rows = []
    for _ in range(height):
        pixels = bytearray()
        for _ in range(width * 4):
            state ^= (state << 13) & 0xFFFFFFFF
            state ^= state >> 17
            state ^= (state << 5) & 0xFFFFFFFF
            pixels.append(state & 0xFF)
        rows.append(b"\x00" + bytes(pixels))
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    return (
        PNG_SIGNATURE
        + png_chunk(b"IHDR", ihdr)
        + png_chunk(b"IDAT", zlib.compress(b"".join(rows)))
        + png_chunk(b"IEND", b"")
    )


def read_standard(art_bible: Path) -> tuple[int, int]:
    text = art_bible.read_text(encoding="utf-8")
    budget_match = re.search(r"Texture size budget:\s*(\d+) bytes", text)
    dimension_match = re.search(r"Maximum texture dimension:\s*(\d+) pixels", text)
    if not budget_match or not dimension_match:
        raise RuntimeError("fixture art bible must define texture byte budget and maximum dimension")
    return int(budget_match.group(1)), int(dimension_match.group(1))


def run_scan(scanner: Path, project_root: Path, size_budget: int, max_dimension: int) -> tuple[int, str, str]:
    result = subprocess.run(
        [
            "bash",
            str(scanner),
            "--root",
            str(project_root),
            "--budget",
            f"texture={size_budget}",
            "--max-dim",
            str(max_dimension),
            "--files",
        ],
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    return result.returncode, result.stdout, result.stderr


def parse_rows(output: str) -> list[list[str]]:
    return [line.split("\t") for line in output.splitlines() if line]


def require_row(rows: list[list[str]], kind: str, *fields: str) -> None:
    if not any(len(row) >= len(fields) + 1 and row[0] == kind and row[1 : 1 + len(fields)] == list(fields) for row in rows):
        raise RuntimeError(f"asset-scan output is missing expected row: {kind} {fields}")


def display_observations(title: str, output: str) -> None:
    print(title)
    for row in parse_rows(output):
        print("  " + " | ".join(row))
    print()


def exercise(ccgs_root: Path, fixtures: Path) -> None:
    ccgs_root = ccgs_root.expanduser().resolve()
    fixtures = fixtures.expanduser().resolve()
    scanner = ccgs_root / ".claude" / "scripts" / "asset-scan.sh"
    if not scanner.is_file():
        raise RuntimeError(f"missing CCGS asset scanner: {scanner}")

    art_bible = fixtures / "design" / "art" / "art-bible.md"
    size_budget, max_dimension = read_standard(art_bible)
    if not (fixtures / "project.yaml").is_file() or not (fixtures / "src" / "asset_loader.gd").is_file():
        raise RuntimeError(f"incomplete Godot fixture: {fixtures}")

    with tempfile.TemporaryDirectory(prefix="ccgs-asset-audit-") as temporary:
        sandbox = Path(temporary)
        project = sandbox / "populated_project"
        shutil.copytree(fixtures, project)
        character_dir = project / "assets" / "art" / "characters"
        character_dir.mkdir(parents=True)
        (character_dir / "char_hero_idle_16.png").write_bytes(make_png(16, 16, 12345))
        (character_dir / "Enemy-Boss.png").write_bytes(make_png(3, 5, 67890))
        (character_dir / "char_unused_idle_4.png").write_bytes(make_png(4, 4, 24680))

        code, output, error = run_scan(scanner, project, size_budget, max_dimension)
        if code != 0:
            raise RuntimeError(f"populated asset scan exited {code}: {error.strip()}\n{output}")
        rows = parse_rows(output)
        require_row(rows, "engine", "godot", "project.yaml")
        require_row(rows, "scanned", "3")
        require_row(rows, "hits", "naming", "1")
        require_row(rows, "hits", "pot", "1")
        require_row(rows, "hits", "size", "1")
        require_row(rows, "hits", "dim", "1")
        require_row(rows, "hits", "orphan", "1")
        require_row(rows, "hits", "missing", "1")
        require_row(rows, "NAMING", "assets/art/characters/Enemy-Boss.png")
        require_row(rows, "POT", "assets/art/characters/Enemy-Boss.png", "3x5", "both")
        require_row(rows, "SIZE", "assets/art/characters/char_hero_idle_16.png")
        require_row(rows, "DIM", "assets/art/characters/char_hero_idle_16.png", "16x16", str(max_dimension))
        require_row(rows, "ORPHAN", "assets/art/characters/char_unused_idle_4.png")
        require_row(rows, "MISSING", "assets/art/characters/char_missing_idle_4.png")
        require_row(rows, "check", "art_pattern", "not_checkable")
        require_row(rows, "check", "format", "not_run")
        require_row(rows, "check", "data", "not_run")
        display_observations("## Populated project: CCGS asset-scan.sh TSV observations", output)

        empty = sandbox / "empty_project"
        (empty / "assets" / "art").mkdir(parents=True)
        shutil.copy2(project / "project.yaml", empty / "project.yaml")
        code, output, error = run_scan(scanner, empty, size_budget, max_dimension)
        if code != 0:
            raise RuntimeError(f"empty asset scan exited {code}: {error.strip()}\n{output}")
        rows = parse_rows(output)
        require_row(rows, "scanned", "0")
        require_row(rows, "hits", "naming", "-")
        require_row(rows, "check", "naming", "not_run")
        display_observations("## Empty project: zero files is not a clean scan", output)

    print("Both invocations exited 0: the scanner ran; it does not assign the Skill's final verdict.")
    print("All PNGs and project files were created or copied inside a temporary directory.")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ccgs-root", type=Path, default=DEFAULT_CCGS_ROOT)
    parser.add_argument("--fixtures", type=Path, default=DEFAULT_FIXTURES)
    args = parser.parse_args()
    try:
        exercise(args.ccgs_root, args.fixtures)
    except (OSError, RuntimeError, ValueError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
