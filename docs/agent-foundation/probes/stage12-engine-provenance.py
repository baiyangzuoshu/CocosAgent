#!/usr/bin/env python3
"""Read-only inventory of the two examples' custom-engine evidence."""

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]


def emit(version, evidence, **details):
    print(json.dumps({"version": version, "evidence": evidence, **details}, ensure_ascii=False))


project2 = ROOT / "2.4.15NewProject"
for relative in ("local/builder.json", "settings/builder.json"):
    data = json.loads((project2 / relative).read_text())
    emit("2.4.15", relative, engine_keys=[key for key in data if "engine" in key.lower()])
emit("2.4.15", "project extension/template inventory",
     packages=[p.name for p in (project2 / "packages").iterdir()],
     build_templates=(project2 / "build-templates").exists(),
     conclusion="engine provenance unresolved from inspected files")

project3 = ROOT / "3.8,7NewProject"
config = json.loads((project3 / "build/mac/cocos.compile.config.json").read_text())
for kind in ("typescript", "native"):
    info = config["engineInfo"][kind]
    emit("3.8.7", "build/mac/cocos.compile.config.json", kind=kind,
         engine_type=info["type"], engine_path=info["path"],
         adjacent_source=str(ROOT / "3.8.7engine"),
         uses_adjacent_source=Path(info["path"]).resolve().is_relative_to(
             (ROOT / "3.8.7engine").resolve()))
emit("3.8.7", "project extension/template inventory",
     extensions=(project3 / "extensions").exists(),
     build_templates=(project3 / "build-templates").exists())
