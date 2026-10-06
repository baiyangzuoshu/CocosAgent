"""Read native hot-update API/search-path state without constructing a manager."""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import re
import signal
import subprocess
import time


ROOT = Path(__file__).resolve().parents[3]
APP2 = ROOT / "2.4.15NewProject/build/jsb-link/publish/mac/hello_world-desktop.app"
APP3 = ROOT / "3.8,7NewProject/build/mac/proj/Release/CocosGame.app"
MAIN2 = APP2 / "Contents/Resources/main.js"
APPLICATION3 = APP3 / "Contents/Resources/application.js"
WRITABLE3 = Path.home() / "Library/Containers/com.cocos.stage4probe/Data/Documents"
OUTPUT3 = WRITABLE3 / "cocos-stage11-hotupdate-inventory.json"
TRACES = ROOT / "docs/agent-foundation/traces"


def replace_once(source: str, needle: str, replacement: str) -> str:
    if source.count(needle) != 1:
        raise ValueError(f"expected one {needle!r}, got {source.count(needle)}")
    return source.replace(needle, replacement, 1)


def app3_pids() -> set[int]:
    output = subprocess.run(["/bin/ps", "-axo", "pid,command"], check=True,
                            capture_output=True, text=True).stdout
    return {int(line.split()[0]) for line in output.splitlines()
            if "CocosGame.app/Contents/MacOS/CocosGame" in line}


def stop_app3(pids: set[int]) -> None:
    for pid in pids:
        try:
            os.kill(pid, signal.SIGTERM)
        except ProcessLookupError:
            pass
    if pids:
        time.sleep(0.5)
    for pid in app3_pids() & pids:
        try:
            os.kill(pid, signal.SIGKILL)
        except ProcessLookupError:
            pass


def run_2x() -> dict:
    original = MAIN2.read_bytes()
    js = '''(function(){try{
      var paths=jsb.fileUtils.getSearchPaths();
      console.log('STAGE11_HOTUPDATE '+JSON.stringify({version:'2.4.15',
        isNative:cc.sys.isNative,hasResourceAssetManager:typeof cc.assetManager,
        hasJsBAssetsManager:typeof jsb.AssetsManager,
        writablePath:jsb.fileUtils.getWritablePath(),searchPaths:paths}));
    }catch(error){console.log('STAGE11_HOTUPDATE '+JSON.stringify({version:'2.4.15',error:String(error)}));}})();'''
    try:
        MAIN2.write_text(replace_once(original.decode(), "window.boot = function () {",
                                      "window.boot = function () {" + js))
        subprocess.run(["node", "--check", str(MAIN2)], check=True, capture_output=True)
        try:
            result = subprocess.run([str(APP2 / "Contents/MacOS/hello_world-desktop")],
                                    cwd=MAIN2.parent, stdout=subprocess.PIPE,
                                    stderr=subprocess.STDOUT, timeout=8, check=False)
            raw = result.stdout
        except subprocess.TimeoutExpired as error:
            raw = error.stdout or b""
        output = raw.decode(errors="replace")
        matches = re.findall(r"STAGE11_HOTUPDATE (\{[^\r\n]+\})", output)
        if not matches:
            raise RuntimeError(f"2.4: no inventory; output tail: {output[-1200:]}")
        return json.loads(matches[-1])
    finally:
        MAIN2.write_bytes(original)
        if MAIN2.read_bytes() != original:
            raise RuntimeError("2.4 main.js restore failed")
        print("2.4 restored", hashlib.sha256(original).hexdigest())


def run_3x() -> dict:
    original = APPLICATION3.read_bytes()
    js = '''(function(){try{
      var paths=jsb.fileUtils.getSearchPaths();
      jsb.fileUtils.writeStringToFile(JSON.stringify({version:'3.8.7',
        isNative:cc.sys.isNative,hasResourceAssetManager:typeof cc.assetManager,
        hasNativeAssetsManager:cc.native ? typeof cc.native.AssetsManager : 'no-native-export',
        hasJsBAssetsManager:typeof jsb.AssetsManager,
        writablePath:jsb.fileUtils.getWritablePath(),searchPaths:paths}),
        jsb.fileUtils.getWritablePath()+'cocos-stage11-hotupdate-inventory.json');
    }catch(error){jsb.fileUtils.writeStringToFile(JSON.stringify({version:'3.8.7',error:String(error)}),
        jsb.fileUtils.getWritablePath()+'cocos-stage11-hotupdate-inventory.json');}})();'''
    before = app3_pids()
    new_pids: set[int] = set()
    OUTPUT3.unlink(missing_ok=True)
    try:
        APPLICATION3.write_text(replace_once(original.decode(), "onPostInitBase() {",
                                             "onPostInitBase() {" + js))
        subprocess.run(["node", "--check", str(APPLICATION3)], check=True, capture_output=True)
        subprocess.run(["/usr/bin/open", "-n", "-a", str(APP3)], check=True, timeout=15)
        for _ in range(25):
            if OUTPUT3.exists():
                break
            time.sleep(0.2)
        new_pids = app3_pids() - before
        if not OUTPUT3.exists():
            raise RuntimeError("3.8: no inventory file")
        return json.loads(OUTPUT3.read_text())
    finally:
        stop_app3(new_pids or (app3_pids() - before))
        OUTPUT3.unlink(missing_ok=True)
        APPLICATION3.write_bytes(original)
        if APPLICATION3.read_bytes() != original:
            raise RuntimeError("3.8 application.js restore failed")
        print("3.8 restored", hashlib.sha256(original).hexdigest())


def main() -> None:
    for version, runner in (("2.4.15", run_2x), ("3.8.7", run_3x)):
        event = runner()
        print(json.dumps(event, ensure_ascii=False))
        if "error" in event:
            raise RuntimeError(f"{version}: inventory failed")
        path = TRACES / f"{version}-stage11-mac-native-hotupdate-inventory.jsonl"
        path.write_text(json.dumps(event, ensure_ascii=False) + "\n")
        print("trace", path)


if __name__ == "__main__":
    main()
