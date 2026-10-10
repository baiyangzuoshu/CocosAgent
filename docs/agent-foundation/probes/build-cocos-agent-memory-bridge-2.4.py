"""Temporarily register the tracked C++ bridge and build the 2.4 Mac app."""

from __future__ import annotations

import argparse
import os
from pathlib import Path
import shutil
import subprocess
import sys


ROOT = Path(__file__).resolve().parents[3]
PROJECT = ROOT / "2.4.15NewProject/build/jsb-link/frameworks/runtime-src/proj.ios_mac/hello_world.xcodeproj"
APP_PROJECT = PROJECT / "project.pbxproj"
ENGINE_INSTALL = Path("/Applications/Cocos/Creator/2.4.15/CocosCreator.app/Contents/Resources/cocos2d-x")
ENGINE_OVERLAY = ROOT / "2.4.15NewProject/build/cocos-agent-native-engine-overlay"
ENGINE_PROJECT = ENGINE_OVERLAY / "build/cocos2d_libs.xcodeproj"
MODULE_SOURCE = ENGINE_OVERLAY / "cocos/scripting/js-bindings/manual/jsb_module_register.cpp"
BRIDGE_HEADER = ROOT / "docs/agent-foundation/native/cocos-agent-memory-bridge-2.4.h"
DEFAULT_DERIVED = ROOT / "2.4.15NewProject/build/cocos-agent-native-memory-bridge"
INCLUDE_MARKER = "#include \"cocos/scripting/js-bindings/jswrapper/SeApi.h\""
REGISTER_MARKER = "    se->addRegisterCallback(register_platform_bindings);"
ENGINE_PROJECT_REF = "/Applications/Cocos/Creator/2.4.15/CocosCreator.app/Contents/Resources/cocos2d-x/build/cocos2d_libs.xcodeproj"


def patch_source(source: str) -> str:
    include = f'#include "{Path(os.path.relpath(BRIDGE_HEADER, MODULE_SOURCE.parent)).as_posix()}"'
    if source.count(INCLUDE_MARKER) != 1 or source.count(REGISTER_MARKER) != 1:
        raise ValueError("Generated JSB module source does not match the expected Creator 2.4 template")
    if include in source or "cocos_agent_register_memory_bridge" in source:
        raise ValueError("Generated JSB module source already contains the bridge")
    source = source.replace(INCLUDE_MARKER, INCLUDE_MARKER + "\n" + include, 1)
    return source.replace(
        REGISTER_MARKER,
        REGISTER_MARKER + "\n    se->addRegisterCallback(cocos_agent_register_memory_bridge);",
        1,
    )


def prepare_overlay() -> None:
    if not ENGINE_INSTALL.is_dir():
        raise SystemExit(f"Creator 2.4.15 native engine source is missing: {ENGINE_INSTALL}")
    ENGINE_OVERLAY.mkdir(parents=True, exist_ok=True)
    for generated_path in (ENGINE_OVERLAY / "cocos", ENGINE_OVERLAY / "extensions", ENGINE_PROJECT):
        if generated_path.is_symlink():
            generated_path.unlink()
        elif generated_path.exists():
            shutil.rmtree(generated_path)
    shutil.copytree(ENGINE_INSTALL / "cocos", ENGINE_OVERLAY / "cocos")
    shutil.copytree(ENGINE_INSTALL / "extensions", ENGINE_OVERLAY / "extensions")
    ENGINE_PROJECT.parent.mkdir(parents=True, exist_ok=True)
    shutil.copytree(ENGINE_INSTALL / "build/cocos2d_libs.xcodeproj", ENGINE_PROJECT)
    external_link = ENGINE_OVERLAY / "external"
    expected_external = ENGINE_INSTALL / "external"
    if external_link.is_symlink() and external_link.resolve() != expected_external.resolve():
        external_link.unlink()
    if not external_link.exists():
        external_link.symlink_to(expected_external, target_is_directory=True)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--derived-data", type=Path, default=DEFAULT_DERIVED)
    args = parser.parse_args()
    if not PROJECT.is_dir() or not BRIDGE_HEADER.is_file():
        raise SystemExit("Build prerequisites are missing; create the 2.4.15 JSB Mac build first.")

    prepare_overlay()
    original = MODULE_SOURCE.read_bytes()
    original_app_project = APP_PROJECT.read_bytes()
    try:
        MODULE_SOURCE.write_text(patch_source(original.decode("utf-8")))
        app_project_source = original_app_project.decode("utf-8")
        if app_project_source.count(ENGINE_PROJECT_REF) != 1:
            raise ValueError("Generated app project does not reference the expected Creator native engine")
        app_project_source = app_project_source.replace(ENGINE_PROJECT_REF, str(ENGINE_PROJECT), 1)
        APP_PROJECT.write_text(app_project_source)
        command = [
            "xcodebuild", "-project", str(PROJECT), "-scheme", "hello_world-desktop",
            "-configuration", "Debug", "-sdk", "macosx", "-destination", "platform=macOS",
            "-derivedDataPath", str(args.derived_data.resolve()), "build", "ARCHS=x86_64",
            "ONLY_ACTIVE_ARCH=YES", "CODE_SIGNING_ALLOWED=NO",
        ]
        result = subprocess.run(command, text=True, stdout=subprocess.PIPE,
                                stderr=subprocess.STDOUT)
        if result.returncode != 0:
            sys.stderr.write(result.stdout[-16000:])
            return result.returncode
    finally:
        MODULE_SOURCE.write_bytes(original)
        APP_PROJECT.write_bytes(original_app_project)

    app = args.derived_data.resolve() / "Build/Products/Debug/hello_world-desktop.app"
    executable = app / "Contents/MacOS/hello_world-desktop"
    if not executable.is_file():
        raise SystemExit(f"Xcode succeeded but the app executable was not found: {executable}")
    print(app)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
