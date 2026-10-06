"""Temporary 2.4.15 Mac package startup probe; restores generated main.js."""

from __future__ import annotations

import hashlib
from pathlib import Path
import subprocess


WORKSPACE = Path(__file__).resolve().parents[3]
APP = (WORKSPACE / "2.4.15NewProject/build/jsb-link/publish/mac/hello_world-desktop.app").resolve()
RESOURCES = APP / "Contents/Resources"
MAIN = RESOURCES / "main.js"


def insert_once(source: str, needle: str, replacement: str) -> str:
    if source.count(needle) != 1:
        raise ValueError(f"Expected exactly one occurrence of {needle!r}")
    return source.replace(needle, replacement, 1)


def build_probe(source: str) -> str:
    source = insert_once(
        source,
        "window.boot = function () {",
        '''window.boot = function () {
    var stage10 = function (event, extra) {
        console.log("STAGE10", JSON.stringify({time_ms:Date.now(),event:event,extra:extra||null}));
    };
    stage10("boot", {CC_JSB:CC_JSB,CC_RUNTIME:CC_RUNTIME,isNative:cc.sys.isNative,
        isBrowser:cc.sys.isBrowser,platform:cc.sys.platform,
        hasWindow:typeof window,hasDocument:typeof document});
    cc.game.once(cc.game.EVENT_ENGINE_INITED, function(){stage10("engine-inited");});
    cc.game.once(cc.game.EVENT_GAME_INITED, function(){stage10("game-inited");});
    cc.director.once(cc.Director.EVENT_AFTER_DRAW, function(){stage10("first-after-draw");});
    cc.director.once(cc.Director.EVENT_AFTER_SCENE_LAUNCH, function(){
        stage10("after-scene-launch");
        cc.director.once(cc.Director.EVENT_AFTER_DRAW, function(){stage10("first-scene-after-draw");});
    });''',
    )
    source = insert_once(
        source,
        "var onStart = function () {",
        'var onStart = function () { stage10("onStart");',
    )
    source = insert_once(
        source,
        "cc.director.runSceneImmediate(scene);",
        'cc.director.runSceneImmediate(scene); stage10("scene-run",{scene:launchScene});',
    )
    return source


def main() -> None:
    original = MAIN.read_bytes()
    modified = build_probe(original.decode())
    try:
        MAIN.write_text(modified)
        subprocess.run(["node", "--check", str(MAIN)], check=True)
        try:
            completed = subprocess.run(
                [str(APP / "Contents/MacOS/hello_world-desktop")],
                cwd=RESOURCES,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                timeout=12,
            )
            output = completed.stdout
            print("exit", completed.returncode)
        except subprocess.TimeoutExpired as error:
            output = error.stdout or b""
            print("timeout")
        print(output.decode(errors="replace")[-10000:])
    finally:
        MAIN.write_bytes(original)
        print("restored", hashlib.sha256(MAIN.read_bytes()).digest() == hashlib.sha256(original).digest())


if __name__ == "__main__":
    main()
