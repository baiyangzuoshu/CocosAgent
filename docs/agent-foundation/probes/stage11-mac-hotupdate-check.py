"""Check an equal or newer remote hot-update version in two existing Mac apps.

Each manager uses a unique temporary storage root. The optional update mode
serves a one-byte sentinel file and restarts the app to inspect the cached
manifest. Generated scripts are restored before deleting only probe roots.
"""

from __future__ import annotations

import hashlib
import argparse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import re
import shutil
import signal
import subprocess
import tempfile
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


SENTINEL = b"A"
SENTINEL_MD5 = "7fc56270e7a70fa81a5935b72eacbe29"


def make_server(token: str, remote_version: str, do_update: bool):
    requests: list[str] = []
    port = 0

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            requests.append(self.path)
            if not self.path.startswith(f"/{token}/"):
                self.send_error(404)
                return
            if self.path.endswith("/version.manifest"):
                payload = {"version": remote_version, "engineVersion": "stage11"}
            elif self.path.endswith("/project.manifest"):
                prefix = self.path.rsplit("/", 1)[0]
                base = f"http://127.0.0.1:{port}{prefix}"
                payload = {"packageUrl": base + "/pkg/",
                           "remoteVersionUrl": base + "/version.manifest",
                           "remoteManifestUrl": base + "/project.manifest",
                           "version": remote_version, "engineVersion": "stage11",
                           "assets": ({"sentinel.bin": {"md5": SENTINEL_MD5, "size": 1}}
                                      if remote_version != "1.0.0" else {}),
                           "searchPaths": []}
            elif do_update and self.path.split("?", 1)[0].endswith("/pkg/sentinel.bin"):
                body = SENTINEL
                self.send_response(200)
                self.send_header("Content-Type", "application/octet-stream")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return
            else:
                self.send_error(404)
                return
            body = json.dumps(payload).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, _format, *_args):
            pass

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    port = server.server_address[1]
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server, requests


def make_manifest(root: Path, base: str, version: str) -> tuple[Path, Path]:
    root.mkdir(parents=True, exist_ok=True)
    local = root / "local.manifest"
    storage = root / "cache"
    local.write_text(json.dumps({
        "packageUrl": f"{base}/{version}/pkg/",
        "remoteVersionUrl": f"{base}/{version}/version.manifest",
        "remoteManifestUrl": f"{base}/{version}/project.manifest",
        "version": "1.0.0", "engineVersion": "stage11",
        "assets": {}, "searchPaths": [],
    }))
    return local, storage


def run_2x(local: Path, storage: Path, do_update: bool = False) -> list[dict]:
    original = MAIN2.read_bytes()
    js = '''setTimeout(function(){
      var report=function(kind,extra){var data={version:'2.4.15',kind:kind};
        if(extra){for(var key in extra){data[key]=extra[key];}}
        console.log('STAGE11_HOTCHECK '+JSON.stringify(data));};
      try{
        var before=jsb.fileUtils.getSearchPaths();
        var manager=new jsb.AssetsManager(LOCAL_HERE,STORAGE_HERE);
        window.__stage11Hotcheck=manager;
        report('constructed',{state:manager.getState(),storage:manager.getStoragePath(),
          stateUpToDate:jsb.AssetsManager.State.UP_TO_DATE,
          stateFailToUpdate:jsb.AssetsManager.State.FAIL_TO_UPDATE,
          eventAlreadyUpToDate:jsb.EventAssetsManager.ALREADY_UP_TO_DATE,
          localLoaded:manager.getLocalManifest().isLoaded(),
          localVersion:manager.getLocalManifest().getVersion(),
          searchPathsBefore:before,searchPathsAfter:jsb.fileUtils.getSearchPaths()});
        manager.setEventCallback(function(event){report('event',{
          code:event.getEventCode(),state:manager.getState(),
          localVersion:manager.getLocalManifest().getVersion(),
          searchPaths:jsb.fileUtils.getSearchPaths()});});
        manager.checkUpdate();
      }catch(error){report('exception',{error:String(error)});}
    },500);'''.replace("LOCAL_HERE", json.dumps(str(local))).replace("STORAGE_HERE", json.dumps(str(storage)))
    js = js.replace("searchPaths:jsb.fileUtils.getSearchPaths()});});",
                    "searchPaths:jsb.fileUtils.getSearchPaths()});" +
                    ("if(event.getEventCode()===3){manager.update();}" if do_update else "") + "});")
    try:
        MAIN2.write_text(replace_once(original.decode(), "window.boot = function () {",
                                      "window.boot = function () {" + js))
        subprocess.run(["node", "--check", str(MAIN2)], check=True, capture_output=True)
        try:
            result = subprocess.run([str(APP2 / "Contents/MacOS/hello_world-desktop")],
                                    cwd=MAIN2.parent, stdout=subprocess.PIPE,
                                    stderr=subprocess.STDOUT, timeout=12, check=False)
            raw = result.stdout
        except subprocess.TimeoutExpired as error:
            raw = error.stdout or b""
        output = raw.decode(errors="replace")
        matches = re.findall(r"STAGE11_HOTCHECK (\{[^\r\n]+\})", output)
        if not matches:
            raise RuntimeError(f"2.4: no hot-update check events; tail: {output[-1600:]}")
        return [json.loads(match) for match in matches]
    finally:
        MAIN2.write_bytes(original)
        if MAIN2.read_bytes() != original:
            raise RuntimeError("2.4 main.js restore failed")
        print("2.4 restored", hashlib.sha256(original).hexdigest())


def run_3x(local: Path, storage: Path, output: Path, expected_code: int,
           do_update: bool = False) -> list[dict]:
    original = APPLICATION3.read_bytes()
    js = '''setTimeout(function(){
      var events=[];
      var report=function(kind,extra){var data={version:'3.8.7',kind:kind};
        if(extra){for(var key in extra){data[key]=extra[key];}}
        events.push(data);jsb.fileUtils.writeStringToFile(JSON.stringify(events),OUTPUT_HERE);};
      try{
        var before=jsb.fileUtils.getSearchPaths();
        var manager=new cc.native.AssetsManager(LOCAL_HERE,STORAGE_HERE);
        window.__stage11Hotcheck=manager;
        report('constructed',{state:manager.getState(),storage:manager.getStoragePath(),
          stateUpToDate:cc.native.AssetsManager.State.UP_TO_DATE,
          stateFailToUpdate:cc.native.AssetsManager.State.FAIL_TO_UPDATE,
          eventAlreadyUpToDate:cc.native.EventAssetsManager.ALREADY_UP_TO_DATE,
          localLoaded:manager.getLocalManifest().isLoaded(),
          localVersion:manager.getLocalManifest().getVersion(),
          searchPathsBefore:before,searchPathsAfter:jsb.fileUtils.getSearchPaths()});
        manager.setEventCallback(function(event){report('event',{
          code:event.getEventCode(),state:manager.getState(),
          localVersion:manager.getLocalManifest().getVersion(),
          searchPaths:jsb.fileUtils.getSearchPaths()});});
        manager.checkUpdate();
      }catch(error){report('exception',{error:String(error)});}
    },500);'''.replace("LOCAL_HERE", json.dumps(str(local))).replace("STORAGE_HERE", json.dumps(str(storage)))
    js = js.replace("searchPaths:jsb.fileUtils.getSearchPaths()});});",
                    "searchPaths:jsb.fileUtils.getSearchPaths()});" +
                    ("if(event.getEventCode()===3){manager.update();}" if do_update else "") + "});")
    js = js.replace("OUTPUT_HERE", json.dumps(str(output)))
    before = app3_pids()
    new_pids: set[int] = set()
    try:
        APPLICATION3.write_text(replace_once(original.decode(), "onPostInitBase() {",
                                             "onPostInitBase() {" + js))
        subprocess.run(["node", "--check", str(APPLICATION3)], check=True, capture_output=True)
        subprocess.run(["/usr/bin/open", "-n", "-a", str(APP3)], check=True, timeout=15)
        events: list[dict] = []
        for _ in range(60):
            if output.exists():
                events = json.loads(output.read_text())
                if events and (events[-1]["kind"] == "exception" or
                               (events[-1]["kind"] == "event" and events[-1].get("code") == expected_code)):
                    break
            time.sleep(0.2)
        if expected_code == 8 and events and events[-1].get("code") == 8:
            time.sleep(0.5)  # Let native code finish its post-callback temp cleanup.
        new_pids = app3_pids() - before
        if not events:
            raise RuntimeError("3.8: no hot-update check events")
        return events
    finally:
        stop_app3(new_pids or (app3_pids() - before))
        APPLICATION3.write_bytes(original)
        if APPLICATION3.read_bytes() != original:
            raise RuntimeError("3.8 application.js restore failed")
        print("3.8 restored", hashlib.sha256(original).hexdigest())


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--remote-version", choices=("1.0.0", "1.0.1"), default="1.0.0")
    parser.add_argument("--do-update", action="store_true")
    args = parser.parse_args()
    if args.do_update and args.remote_version != "1.0.1":
        parser.error("--do-update requires --remote-version 1.0.1")
    expected_code = 8 if args.do_update else (4 if args.remote_version == "1.0.0" else 3)
    trace_kind = ("hotupdate-update" if args.do_update else
                  "hotupdate-check" if expected_code == 4 else "hotupdate-new-version-check")
    token = uuid.uuid4().hex
    server, requests = make_server(token, args.remote_version, args.do_update)
    root2 = Path(tempfile.mkdtemp(prefix="cocos-stage11-hotcheck-", dir="/private/tmp"))
    WRITABLE3.mkdir(parents=True, exist_ok=True)
    root3 = Path(tempfile.mkdtemp(prefix="cocos-stage11-hotcheck-", dir=WRITABLE3))
    base = f"http://127.0.0.1:{server.server_address[1]}/{token}"
    try:
        for version, root, runner in (("2.4.15", root2, run_2x), ("3.8.7", root3, run_3x)):
            local, storage = make_manifest(root, base, version)
            before = len(requests)
            events = (runner(local, storage, args.do_update) if version == "2.4.15" else
                      runner(local, storage, root / "result.json", expected_code, args.do_update))
            seen = requests[before:]
            print(version, "events", json.dumps(events, ensure_ascii=False))
            print(version, "requests", json.dumps(seen))
            if args.do_update:
                sentinel = storage / "sentinel.bin"
                cached_manifest = storage / "project.manifest"
                disk = {"version": version, "phase": "update", "kind": "disk_snapshot",
                        "paths": sorted(str(path.relative_to(root)) for path in root.rglob("*")
                                        if path.name not in ("local.manifest", "result.json")),
                        "sentinelHex": sentinel.read_bytes().hex() if sentinel.exists() else None,
                        "cachedVersion": (json.loads(cached_manifest.read_text()).get("version")
                                          if cached_manifest.exists() else None)}
                print(version, "disk", json.dumps(disk))
                before_restart = len(requests)
                restarted = (runner(local, storage) if version == "2.4.15" else
                             runner(local, storage, root / "restart-result.json", 4))
                restart_seen = requests[before_restart:]
                print(version, "restart events", json.dumps(restarted, ensure_ascii=False))
                print(version, "restart requests", json.dumps(restart_seen))
                records = ([dict(event, phase="update") for event in events] + [disk] +
                           [dict(event, phase="restart") for event in restarted])
                server_records = ([{"phase": "update", "path": item} for item in seen] +
                                  [{"phase": "restart", "path": item} for item in restart_seen])
            else:
                records = events
                server_records = [{"path": item} for item in seen]
            if expected_code == 3:
                disk_paths = sorted(str(path.relative_to(root)) for path in root.rglob("*")
                                    if path.name not in ("local.manifest", "result.json"))
                records.append({"version": version, "kind": "disk_snapshot", "paths": disk_paths})
                print(version, "disk", json.dumps(disk_paths))
            path = TRACES / f"{version}-stage11-mac-native-{trace_kind}.jsonl"
            path.write_text("\n".join(json.dumps(event, ensure_ascii=False) for event in records) + "\n")
            server_path = TRACES / f"{version}-stage11-mac-native-{trace_kind}-server.jsonl"
            server_path.write_text("\n".join(json.dumps(event) for event in server_records) + "\n")
            observed = events
            if observed[0]["kind"] != "constructed" or any(event["kind"] != "event" for event in observed[1:]):
                raise RuntimeError(f"{version}: unexpected event sequence")
            if observed[-1]["code"] != expected_code:
                raise RuntimeError(f"{version}: expected event code {expected_code}")
            expected_requests = [f"/{token}/{version}/version.manifest"]
            if expected_code in (3, 8):
                expected_requests.append(f"/{token}/{version}/project.manifest")
            if args.do_update:
                asset_path = f"/{token}/{version}/pkg/sentinel.bin"
                if (seen[:2] != expected_requests or len(seen) != 3 or
                        seen[2].split("?", 1)[0] != asset_path or
                        disk["sentinelHex"] != SENTINEL.hex() or
                        disk["cachedVersion"] != args.remote_version or
                        restarted[0].get("localVersion") != args.remote_version or
                        restarted[-1].get("code") != 4 or
                        restart_seen != [expected_requests[0]]):
                    raise RuntimeError(f"{version}: update or restart evidence differs")
            elif seen != expected_requests:
                raise RuntimeError(f"{version}: unexpected network requests: {seen}")
    finally:
        server.shutdown()
        server.server_close()
        shutil.rmtree(root2)
        shutil.rmtree(root3)
        print("temporary roots removed")


if __name__ == "__main__":
    main()
