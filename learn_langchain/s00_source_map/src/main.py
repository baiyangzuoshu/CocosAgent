from __future__ import annotations

import tomllib
from pathlib import Path
from typing import Any


REPOSITORY_ROOT = Path(__file__).resolve().parents[3]
LANGCHAIN_ROOT = REPOSITORY_ROOT / "AI" / "langchain-master"
PACKAGES = (
    ("libs/core", "libs/core/pyproject.toml"),
    ("libs/langchain_v1", "libs/langchain_v1/pyproject.toml"),
    ("libs/langchain", "libs/langchain/pyproject.toml"),
)


def read_project_metadata(manifest_path: Path) -> dict[str, Any]:
    with manifest_path.open("rb") as manifest_file:
        project = tomllib.load(manifest_file)["project"]
    return project


def main() -> None:
    print("LangChain 本地源码包地图")
    print(f"源码根目录：{LANGCHAIN_ROOT.relative_to(REPOSITORY_ROOT)}")
    print()
    print(f"{'包名':<20} {'版本':<10} {'Python 要求':<24} 源码目录")

    for source_directory, manifest_relative_path in PACKAGES:
        manifest_path = LANGCHAIN_ROOT / manifest_relative_path
        project = read_project_metadata(manifest_path)
        package_directory = Path("AI/langchain-master") / source_directory
        print(
            f"{project['name']:<20} {project['version']:<10} "
            f"{project['requires-python']:<24} {package_directory}"
        )

    print()
    print("Agent 运行时源码：AI/langgraph-main/（独立仓库快照）")


if __name__ == "__main__":
    main()
