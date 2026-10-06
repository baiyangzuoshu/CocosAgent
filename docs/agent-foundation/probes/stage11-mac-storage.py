"""Probe a unique localStorage key in existing Mac packages; restore generated scripts."""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import re
import signal
import subprocess
import time
import uuid


ROOT = Path(__file__).resolve().parents[3]
TRACE_DIR = ROOT / "docs/agent-foundation/traces"
APP2 = ROOT / "2.4.15NewProject/build/jsb-link/publish/mac/hello_world-desktop.app"
APP3 = ROOT / "3.8,7NewProject/build/mac/proj/Release/CocosGame.app"
MAIN2 = APP2 / "Contents/Resources/main.js"
APPLICATION3 = APP3 / "Contents/Resources/application.js"
WRITABLE3 = Path.home() / "Library/Containers/com.cocos.stage4probe/Data/Documents"


def replace_once(source: str, needle: str, replacement: str) -> str:
    if source.count(needle) != 1:
        raise ValueError(f"expected one {needle!r}, got {source.count(needle)}")
    return source.replace(needle, replacement, 1)


def storage_js(version: str, phase: str, key: str, value: str, output_name: str = "") -> str:
    setup = f"var key={json.dumps(key)}, value={json.dumps(value)}, phase={json.dumps(phase)};"
    if phase == "write":
        action = "var before=storage.getItem(key);storage.setItem(key,value);var after=storage.getItem(key);"
    else:
        action = "var before=storage.getItem(key);storage.removeItem(key);var after=storage.getItem(key);"
    record = (
        f"{{version:{json.dumps(version)},phase:phase,key:key,before:before,after:after,"
        "isNative:cc.sys.isNative,isBrowser:cc.sys.isBrowser,"
        "hasWindowStorage:typeof window.localStorage,"
        "sameWindowStorage:storage===window.localStorage}"
    )
    body = (
        "try{" + setup + "var storage=cc.sys.localStorage;" + action + "var record=" + record + ";"
        + (f"jsb.fileUtils.writeStringToFile(JSON.stringify(record),jsb.fileUtils.getWritablePath()+{json.dumps(output_name)});"
           if output_name else "console.log('STAGE11_STORAGE '+JSON.stringify(record));")
        + "}catch(error){"
        + (f"jsb.fileUtils.writeStringToFile(JSON.stringify({{version:{json.dumps(version)},phase:{json.dumps(phase)},error:String(error)}}),jsb.fileUtils.getWritablePath()+{json.dumps(output_name)});"
           if output_name else f"console.log('STAGE11_STORAGE '+JSON.stringify({{version:{json.dumps(version)},phase:{json.dumps(phase)},error:String(error)}}));")
        + "}"
    )
    return body


def check_js(path: Path) -> None:
    subprocess.run(["node", "--check", str(path)], check=True, capture_output=True)


def run_2x(key: str, value: str) -> list[dict]:
    original = MAIN2.read_bytes()
    events = []
    try:
        for phase in ("write", "read-remove"):
            body = storage_js("2.4.15", phase, key, value)
            modified = replace_once(original.decode(), "window.boot = function () {", "window.boot = function () {" + body)
            MAIN2.write_text(modified)
            check_js(MAIN2)
            executable = APP2 / "Contents/MacOS/hello_world-desktop"
            try:
                result = subprocess.run([str(executable)], cwd=MAIN2.parent,
                                        stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                        timeout=8, check=False)
                raw = result.stdout
            except subprocess.TimeoutExpired as error:
                raw = error.stdout or b""
            output = raw.decode(errors="replace")
            matches = re.findall(r"STAGE11_STORAGE (\{[^\r\n]+\})", output)
            if not matches:
                raise RuntimeError(f"2.4 {phase}: no event; output tail: {output[-1500:]}")
            events.append(json.loads(matches[-1]))
    finally:
        MAIN2.write_bytes(original)
        if MAIN2.read_bytes() != original:
            raise RuntimeError("2.4 main.js restore failed")
        print("2.4 restored", hashlib.sha256(original).hexdigest())
    return events


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


def run_3x(key: str, value: str) -> list[dict]:
    original = APPLICATION3.read_bytes()
    events = []
    try:
        for phase in ("write", "read-remove"):
            output_name = f"cocos-stage11-storage-{uuid.uuid4().hex}.json"
            output_path = WRITABLE3 / output_name
            before_pids = app3_pids()
            body = storage_js("3.8.7", phase, key, value, output_name)
            modified = replace_once(original.decode(), "onPostInitBase() {", "onPostInitBase() {" + body)
            APPLICATION3.write_text(modified)
            check_js(APPLICATION3)
            new_pids: set[int] = set()
            try:
                subprocess.run(["/usr/bin/open", "-n", "-a", str(APP3)], check=True, timeout=15)
                for _ in range(25):
                    if output_path.exists():
                        break
                    time.sleep(0.2)
                new_pids = app3_pids() - before_pids
                if not output_path.exists():
                    raise RuntimeError(f"3.8 {phase}: no event at {output_path}")
                events.append(json.loads(output_path.read_text()))
            finally:
                stop_app3(new_pids or (app3_pids() - before_pids))
                output_path.unlink(missing_ok=True)
    finally:
        APPLICATION3.write_bytes(original)
        if APPLICATION3.read_bytes() != original:
            raise RuntimeError("3.8 application.js restore failed")
        print("3.8 restored", hashlib.sha256(original).hexdigest())
    return events


def main() -> None:
    token = uuid.uuid4().hex
    key = "cocos-stage11-probe-" + token
    value = "stage11-" + token
    for label, runner in (("2.4.15", run_2x), ("3.8.7", run_3x)):
        events = runner(key, value)
        for event in events:
            print(json.dumps(event, ensure_ascii=False))
        if any("error" in event for event in events):
            raise RuntimeError(f"{label}: storage API error")
        if events[0]["after"] != value or events[1]["before"] != value or events[1]["after"] is not None:
            raise RuntimeError(f"{label}: unexpected storage sequence")
        path = TRACE_DIR / f"{label}-stage11-mac-native-storage.jsonl"
        path.write_text("\n".join(json.dumps(event, ensure_ascii=False) for event in events) + "\n")
        print("trace", path)


if __name__ == "__main__":
    main()
