"""Probe the two generated Mac apps; always restore their entry scripts."""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import re
import signal
import subprocess
import sys
import time


ROOT = Path(__file__).resolve().parents[3]
APPS = {
    "2.4": ROOT / "2.4.15NewProject/build/jsb-link/publish/mac/hello_world-desktop.app",
    "3.8": ROOT / "3.8,7NewProject/build/mac/proj/Release/CocosGame.app",
}
PIDS = {"2.4": "hello_world-desktop.app/Contents/MacOS/hello_world-desktop", "3.8": "CocosGame.app/Contents/MacOS/CocosGame"}
WRITABLE = Path.home() / "Library/Containers/com.cocos.stage4probe/Data/Documents"
PREFIX = "cocos-dynamic-native-"
TRACES = ROOT / "docs/agent-foundation/traces"


def pids(version: str) -> set[int]:
    result = subprocess.run(["/bin/ps", "-axo", "pid,command"], capture_output=True, text=True, check=True)
    return {int(line.split()[0]) for line in result.stdout.splitlines() if PIDS[version] in line}


def inject(source: str, needle: str, insert: str) -> str:
    if source.count(needle) != 1:
        raise ValueError(f"Expected one {needle!r}; found {source.count(needle)}")
    return source.replace(needle, needle + insert, 1)


def probe_js(version: str) -> str:
    path = "name + '/texture'" if version == "3.8" else "name"
    manager = "cc.assetManager" if version == "3.8" else "cc.assetManager"
    return f'''\n(function() {{
  var seq = 0;
  function log(phase, extra) {{
    var record = JSON.stringify({{version:{json.dumps(version)},seq:++seq,phase:phase,extra:extra||{{}},time_ms:Date.now()}});
    try {{ jsb.fileUtils.writeStringToFile(record, jsb.fileUtils.getWritablePath()+"{PREFIX}{version}-"+String(seq).padStart(2,"0")+".json"); }}
    catch(e) {{ console.error(e); }}
    console.log("COCOS_DYNAMIC_NATIVE", record);
  }}
  function id(asset) {{ return asset.uuid || asset._uuid; }}
  function load(name, done) {{ cc.resources.load({path}, cc.Texture2D, done); }}
  cc.director.once(cc.Director.EVENT_AFTER_SCENE_LAUNCH, function() {{
    var names = ["red","blue","red","blue"], held = null, index = 0, failed = false;
    log("scene-launched", {{isNative:cc.sys.isNative,scene:cc.director.getScene().name}});
    function finish() {{
      if(held) held.decRef();
      {manager}.releaseUnusedAssets();
      setTimeout(function() {{ log("cleanup", {{heldValid:held&&cc.isValid(held),heldCached:held&&{manager}.assets.has(id(held))}}); }}, 250);
    }}
    function next() {{
      if(index === names.length) return finish();
      var phase = names[index++];
      load("cocos-agent-batch-"+phase, function(error, texture) {{
        if(error) return log("load-error", {{phase:phase,error:String(error)}});
        texture.addRef();
        var previous = held;
        held = texture;
        if(previous) previous.decRef();
        {manager}.releaseUnusedAssets();
        setTimeout(function() {{
          log("swap", {{phase:phase,currentUuid:id(texture),
            currentRefCount:texture.refCount,currentCached:{manager}.assets.has(id(texture)),
            previous:previous&&{{refCount:previous.refCount,cached:{manager}.assets.has(id(previous)),valid:cc.isValid(previous)}}}});
          if(phase === "blue" && !failed) {{
            failed = true;
            return load("cocos-agent-batch-missing", function(missingError) {{
              log("load-failed-preserved", {{hasError:!!missingError,retainedRefCount:held.refCount,
                retainedCached:{manager}.assets.has(id(held)),retainedValid:cc.isValid(held)}});
              next();
            }});
          }}
          next();
        }}, 250);
      }});
    }}
    next();
  }});
}})();\n'''


def main(version: str) -> None:
    app = APPS[version]
    entry = app / "Contents/Resources" / ("main.js" if version == "2.4" else "application.js")
    original = entry.read_bytes()
    source = original.decode()
    if version == "2.4":
        modified = inject(source, "window.boot = function () {", probe_js(version))
    else:
        modified = inject(source, "cc = engine;", probe_js(version))
    before = pids(version)
    for path in WRITABLE.glob(f"{PREFIX}{version}-*.json"):
        path.unlink()
    new_pids: set[int] = set()
    try:
        entry.write_text(modified)
        subprocess.run(["node", "--check", str(entry)], check=True)
        if version == "2.4":
            try:
                completed = subprocess.run([str(app / "Contents/MacOS/hello_world-desktop")],
                    cwd=entry.parent, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=10)
                output = completed.stdout or b""
            except subprocess.TimeoutExpired as error:
                output = error.stdout or b""
            decoded = output.decode(errors="replace")
            events = [json.loads(match) for match in re.findall(r"COCOS_DYNAMIC_NATIVE (\{[^\r\n]+\})", decoded)]
            if not events: print("output_tail", decoded[-2500:])
        else:
            subprocess.run(["/usr/bin/open", "-n", "-a", str(app)], check=True, timeout=15)
            time.sleep(9)
            new_pids = pids(version) - before
            events = [json.loads(path.read_text()) for path in sorted(WRITABLE.glob(f"{PREFIX}{version}-*.json"))]
        for event in events:
            print(json.dumps(event, ensure_ascii=False))
        print("result", json.dumps({"version": version, "events": len(events), "phases": [e["phase"] for e in events]}))
        if [e["phase"] for e in events] != ["scene-launched", "swap", "swap", "load-failed-preserved", "swap", "swap", "cleanup"]:
            raise RuntimeError("Incomplete native probe trace")
        trace = TRACES / f"cocos-agent-dynamic-native-mac-{version}.jsonl"
        trace.write_text("".join(json.dumps(event, ensure_ascii=False) + "\n" for event in events))
    finally:
        new_pids |= pids(version) - before
        for pid in new_pids:
            try: os.kill(pid, signal.SIGTERM)
            except ProcessLookupError: pass
        entry.write_bytes(original)
        print("restored", hashlib.sha256(entry.read_bytes()).digest() == hashlib.sha256(original).digest())


if __name__ == "__main__":
    if len(sys.argv) != 2 or sys.argv[1] not in APPS:
        raise SystemExit("usage: cocos-dynamic-native-mac.py 2.4|3.8")
    main(sys.argv[1])
