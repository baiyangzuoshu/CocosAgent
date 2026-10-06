"""Exercise loopback HTTP in existing Mac packages, restoring generated scripts."""

from __future__ import annotations

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import hashlib
import json
import os
from pathlib import Path
import re
import signal
import subprocess
import threading
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


def running_app3() -> set[int]:
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
    for pid in running_app3() & pids:
        try:
            os.kill(pid, signal.SIGKILL)
        except ProcessLookupError:
            pass


def make_server(token: str):
    requests: list[str] = []

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            requests.append(self.path)
            body = f"stage11:{token}:{self.path}".encode()
            self.send_response(503 if "-http-503" in self.path else 200)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, _format, *_args):
            pass

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server, requests


def run_2x(base: str, token: str) -> list[dict]:
    original = MAIN2.read_bytes()
    urls = {case: base + "/2.4-xhr-" + case + "?token=" + token
            for case in ("ok", "http-503")}
    probe = '''(function(){
      var urls=URLS_HERE;
      ['ok','http-503'].forEach(function(testCase){
        var xhr=new XMLHttpRequest();
        var report=function(outcome){console.log('STAGE11_NETWORK '+JSON.stringify({
          version:'2.4.15',api:'xhr',case:testCase,outcome:outcome,status:xhr.status,
          readyState:xhr.readyState,text:xhr.responseText,
          isNative:cc.sys.isNative,isBrowser:cc.sys.isBrowser}));};
        xhr.onload=function(){report('load');};
        xhr.onerror=function(){report('error');};
        xhr.ontimeout=function(){report('timeout');};
        xhr.open('GET',urls[testCase],true);xhr.timeout=4000;xhr.send();
      });
    })();'''.replace("URLS_HERE", json.dumps(urls))
    try:
        MAIN2.write_text(replace_once(original.decode(), "window.boot = function () {",
                                      "window.boot = function () {" + probe))
        subprocess.run(["node", "--check", str(MAIN2)], check=True, capture_output=True)
        try:
            result = subprocess.run([str(APP2 / "Contents/MacOS/hello_world-desktop")],
                                    cwd=MAIN2.parent, stdout=subprocess.PIPE,
                                    stderr=subprocess.STDOUT, timeout=9, check=False)
            raw = result.stdout
        except subprocess.TimeoutExpired as error:
            raw = error.stdout or b""
        output = raw.decode(errors="replace")
        matches = re.findall(r"STAGE11_NETWORK (\{[^\r\n]+\})", output)
        if len(matches) != 2:
            raise RuntimeError(f"2.4: expected two HTTP callbacks, got {len(matches)}; tail: {output[-1400:]}")
        return [json.loads(match) for match in matches]
    finally:
        MAIN2.write_bytes(original)
        if MAIN2.read_bytes() != original:
            raise RuntimeError("2.4 main.js restore failed")
        print("2.4 restored", hashlib.sha256(original).hexdigest())


def run_3x(base: str, token: str) -> list[dict]:
    original = APPLICATION3.read_bytes()
    urls = {f"{kind}-{case}": base + "/3.8-" + kind + "-" + case + "?token=" + token
            for kind in ("xhr", "fetch") for case in ("ok", "http-503")}
    names = {kind: f"cocos-stage11-network-{token}-{kind}.json" for kind in urls}
    js = '''(function(){
      var emit=function(kind,data){try{jsb.fileUtils.writeStringToFile(JSON.stringify(data),
        jsb.fileUtils.getWritablePath()+NAMES[kind]);}catch(error){console.error(error);}};
      var urls=URLS_HERE;
      ['ok','http-503'].forEach(function(testCase){
        var xhr=new XMLHttpRequest();
        xhr.onload=function(){emit('xhr-'+testCase,{version:'3.8.7',api:'xhr',case:testCase,outcome:'load',
          status:xhr.status,readyState:xhr.readyState,text:xhr.responseText,
          isNative:cc.sys.isNative,isBrowser:cc.sys.isBrowser});};
        xhr.onerror=function(){emit('xhr-'+testCase,{version:'3.8.7',api:'xhr',case:testCase,outcome:'error',status:xhr.status});};
        xhr.ontimeout=function(){emit('xhr-'+testCase,{version:'3.8.7',api:'xhr',case:testCase,outcome:'timeout',status:xhr.status});};
        xhr.open('GET',urls['xhr-'+testCase],true);xhr.timeout=4000;xhr.send();
        fetch(urls['fetch-'+testCase]).then(function(response){return response.text().then(function(body){
          emit('fetch-'+testCase,{version:'3.8.7',api:'fetch',case:testCase,outcome:'resolved',status:response.status,
            text:body,polyfill:fetch.polyfill===true,isNative:cc.sys.isNative,isBrowser:cc.sys.isBrowser});
        });}).catch(function(error){emit('fetch-'+testCase,{version:'3.8.7',api:'fetch',case:testCase,outcome:'rejected',error:String(error)});});
      });
    })();'''
    js = js.replace("NAMES", json.dumps(names)).replace("URLS_HERE", json.dumps(urls))
    before = running_app3()
    new_pids: set[int] = set()
    try:
        APPLICATION3.write_text(replace_once(original.decode(), "onPostInitBase() {",
                                             "onPostInitBase() {" + js))
        subprocess.run(["node", "--check", str(APPLICATION3)], check=True, capture_output=True)
        subprocess.run(["/usr/bin/open", "-n", "-a", str(APP3)], check=True, timeout=15)
        paths = {kind: WRITABLE3 / name for kind, name in names.items()}
        for _ in range(40):
            if all(path.exists() for path in paths.values()):
                break
            time.sleep(0.2)
        new_pids = running_app3() - before
        if not all(path.exists() for path in paths.values()):
            raise RuntimeError(f"3.8: missing HTTP callbacks: {[str(path) for path in paths.values() if not path.exists()]}")
        return [json.loads(paths[kind].read_text()) for kind in urls]
    finally:
        stop_app3(new_pids or (running_app3() - before))
        for name in names.values():
            (WRITABLE3 / name).unlink(missing_ok=True)
        APPLICATION3.write_bytes(original)
        if APPLICATION3.read_bytes() != original:
            raise RuntimeError("3.8 application.js restore failed")
        print("3.8 restored", hashlib.sha256(original).hexdigest())


def main() -> None:
    token = uuid.uuid4().hex
    server, requests = make_server(token)
    base = f"http://127.0.0.1:{server.server_address[1]}/stage11"
    try:
        for version, runner, expected in (("2.4.15", run_2x, {( "xhr", case) for case in ("ok", "http-503")}),
                                          ("3.8.7", run_3x, {(api, case) for api in ("xhr", "fetch") for case in ("ok", "http-503")})):
            events = runner(base, token)
            for event in events:
                print(json.dumps(event, ensure_ascii=False))
            if {(event["api"], event["case"]) for event in events} != expected:
                raise RuntimeError(f"{version}: missing API event")
            for event in events:
                status = 503 if event["case"] == "http-503" else 200
                if event.get("status") != status or event.get("outcome") not in ("load", "resolved"):
                    raise RuntimeError(f"{version} {event['api']}: request failed")
                if token not in event.get("text", ""):
                    raise RuntimeError(f"{version} {event['api']}: unexpected response")
            path = TRACES / f"{version}-stage11-mac-native-http.jsonl"
            path.write_text("\n".join(json.dumps(event, ensure_ascii=False) for event in events) + "\n")
            print("trace", path)
        print("server_requests", json.dumps(requests))
    finally:
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    main()
