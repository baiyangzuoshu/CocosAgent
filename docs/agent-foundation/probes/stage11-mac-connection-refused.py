"""Probe business HTTP connection refusal in existing Mac packages.

The test port is bound without listen(), so no local server can accept the
request. Generated application scripts are restored byte for byte.
"""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import re
import signal
import socket
import subprocess
import time
import uuid


ROOT = Path(__file__).resolve().parents[3]
TRACES = ROOT / "docs/agent-foundation/traces"
APP2 = ROOT / "2.4.15NewProject/build/jsb-link/publish/mac/hello_world-desktop.app"
APP3 = ROOT / "3.8,7NewProject/build/mac/proj/Release/CocosGame.app"
MAIN2 = APP2 / "Contents/Resources/main.js"
APPLICATION3 = APP3 / "Contents/Resources/application.js"
WRITABLE3 = Path.home() / "Library/Containers/com.cocos.stage4probe/Data/Documents"


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


def run_2x(url: str) -> list[dict]:
    original = MAIN2.read_bytes()
    js = '''(function(){
      var xhr=new XMLHttpRequest();
      var report=function(outcome){console.log('STAGE11_REFUSED '+JSON.stringify({
        version:'2.4.15',api:'xhr',outcome:outcome,status:xhr.status,
        readyState:xhr.readyState,text:xhr.responseText,
        isNative:cc.sys.isNative,isBrowser:cc.sys.isBrowser}));};
      xhr.onload=function(){report('load');};
      xhr.onerror=function(){report('error');};
      xhr.ontimeout=function(){report('timeout');};
      xhr.open('GET',URL_HERE,true);xhr.timeout=4000;xhr.send();
    })();'''.replace("URL_HERE", json.dumps(url))
    try:
        MAIN2.write_text(replace_once(original.decode(), "window.boot = function () {",
                                      "window.boot = function () {" + js))
        subprocess.run(["node", "--check", str(MAIN2)], check=True, capture_output=True)
        try:
            result = subprocess.run([str(APP2 / "Contents/MacOS/hello_world-desktop")],
                                    cwd=MAIN2.parent, stdout=subprocess.PIPE,
                                    stderr=subprocess.STDOUT, timeout=9, check=False)
            raw = result.stdout
        except subprocess.TimeoutExpired as error:
            raw = error.stdout or b""
        output = raw.decode(errors="replace")
        matches = re.findall(r"STAGE11_REFUSED (\{[^\r\n]+\})", output)
        if not matches:
            raise RuntimeError(f"2.4: no callback; output tail: {output[-1400:]}")
        return [json.loads(match) for match in matches]
    finally:
        MAIN2.write_bytes(original)
        if MAIN2.read_bytes() != original:
            raise RuntimeError("2.4 main.js restore failed")
        print("2.4 restored", hashlib.sha256(original).hexdigest())


def run_3x(url: str, token: str) -> list[dict]:
    original = APPLICATION3.read_bytes()
    names = {kind: f"cocos-stage11-refused-{token}-{kind}.json" for kind in ("xhr", "fetch")}
    paths = {kind: WRITABLE3 / name for kind, name in names.items()}
    js = '''(function(){
      var emit=function(kind,data){try{jsb.fileUtils.writeStringToFile(JSON.stringify(data),
        jsb.fileUtils.getWritablePath()+NAMES[kind]);}catch(error){console.error(error);}};
      var xhr=new XMLHttpRequest();
      var report=function(outcome){emit('xhr',{version:'3.8.7',api:'xhr',outcome:outcome,
        status:xhr.status,readyState:xhr.readyState,text:xhr.responseText,
        isNative:cc.sys.isNative,isBrowser:cc.sys.isBrowser});};
      xhr.onload=function(){report('load');};
      xhr.onerror=function(){report('error');};
      xhr.ontimeout=function(){report('timeout');};
      xhr.open('GET',URL_HERE,true);xhr.timeout=4000;xhr.send();
      fetch(URL_HERE).then(function(response){return response.text().then(function(body){
        emit('fetch',{version:'3.8.7',api:'fetch',outcome:'resolved',status:response.status,
          text:body,polyfill:fetch.polyfill===true});
      });}).catch(function(error){emit('fetch',{version:'3.8.7',api:'fetch',outcome:'rejected',
        error:String(error),polyfill:fetch.polyfill===true});});
    })();'''.replace("NAMES", json.dumps(names)).replace("URL_HERE", json.dumps(url))
    before = app3_pids()
    new_pids: set[int] = set()
    try:
        APPLICATION3.write_text(replace_once(original.decode(), "onPostInitBase() {",
                                             "onPostInitBase() {" + js))
        subprocess.run(["node", "--check", str(APPLICATION3)], check=True, capture_output=True)
        subprocess.run(["/usr/bin/open", "-n", "-a", str(APP3)], check=True, timeout=15)
        for _ in range(50):
            if all(path.exists() for path in paths.values()):
                break
            time.sleep(0.2)
        new_pids = app3_pids() - before
        if not all(path.exists() for path in paths.values()):
            raise RuntimeError(f"3.8: missing callbacks: {[k for k, p in paths.items() if not p.exists()]}")
        return [json.loads(paths[kind].read_text()) for kind in names]
    finally:
        stop_app3(new_pids or (app3_pids() - before))
        for path in paths.values():
            path.unlink(missing_ok=True)
        APPLICATION3.write_bytes(original)
        if APPLICATION3.read_bytes() != original:
            raise RuntimeError("3.8 application.js restore failed")
        print("3.8 restored", hashlib.sha256(original).hexdigest())


def main() -> None:
    token = uuid.uuid4().hex
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as reserved:
        reserved.bind(("127.0.0.1", 0))
        port = reserved.getsockname()[1]
        url = f"http://127.0.0.1:{port}/stage11-refused?token={token}"
        for version, runner in (("2.4.15", lambda: run_2x(url)),
                                ("3.8.7", lambda: run_3x(url, token))):
            events = runner()
            if {event.get("api") for event in events} != ({"xhr"} if version == "2.4.15" else {"xhr", "fetch"}):
                raise RuntimeError(f"{version}: unexpected callbacks {events}")
            path = TRACES / f"{version}-stage11-mac-native-connection-refused.jsonl"
            path.write_text("\n".join(json.dumps(event, ensure_ascii=False) for event in events) + "\n")
            for event in events:
                print(json.dumps(event, ensure_ascii=False))
            print("trace", path)


if __name__ == "__main__":
    main()
