"""Temporary 3.8.7 Mac package startup probe; restores both generated files."""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import shutil
import signal
import subprocess
import time


WORKSPACE = Path(__file__).resolve().parents[3]
APP = (WORKSPACE / "3.8,7NewProject/build/mac/proj/Release/CocosGame.app").resolve()
RESOURCES = APP / "Contents/Resources"
MAIN = RESOURCES / "main.js"
APPLICATION = RESOURCES / "application.js"
WRITABLE = Path.home() / "Library/Containers/com.cocos.stage4probe/Data/Documents"
EVENT_GLOB = "cocos-stage10-3.8-event-*.json"


def running_pids() -> set[int]:
    result = subprocess.run(
        ["/bin/ps", "-axo", "pid,command"], capture_output=True, text=True, check=True
    )
    return {
        int(line.split()[0])
        for line in result.stdout.splitlines()
        if "CocosGame.app/Contents/MacOS/CocosGame" in line
    }


def insert_once(source: str, needle: str, replacement: str) -> str:
    if source.count(needle) != 1:
        raise ValueError(f"Expected exactly one occurrence of {needle!r}")
    return source.replace(needle, replacement, 1)


def build_probes(main: str, application: str) -> tuple[str, str]:
    entry = '''globalThis.__stage10Seq=0; globalThis.__stage10=function(event,extra){
  try { var n=++globalThis.__stage10Seq;
    var p=jsb.fileUtils.getWritablePath()+"cocos-stage10-3.8-event-"+String(n).padStart(2,"0")+".json";
    jsb.fileUtils.writeStringToFile(JSON.stringify({seq:n,time_ms:Date.now(),event:event,extra:extra||null}),p);
  } catch(e) { console.error(e); }
};
globalThis.__stage10("main-entry");
'''
    main = entry + main
    for needle, replacement in [
        ('require("src/system.bundle.js");', 'require("src/system.bundle.js"); globalThis.__stage10("system-bundle-loaded");'),
        ("System.import('./application.js')", "globalThis.__stage10('before-application-import'); System.import('./application.js')"),
        ('return new Application();', 'globalThis.__stage10("application-module-loaded"); return new Application();'),
        ('return application.init(cc);', 'globalThis.__stage10("engine-adapter-loaded"); return application.init(cc);'),
        ('return application.start();', 'globalThis.__stage10("before-application-start"); return application.start();'),
        ('console.error(err.toString()', 'globalThis.__stage10("startup-error",{message:err.toString()}); console.error(err.toString()'),
    ]:
        main = insert_once(main, needle, replacement)

    application = insert_once(
        application,
        'init(engine) {',
        'init(engine) { globalThis.__stage10("application-init");',
    )
    application = insert_once(
        application,
        'cc = engine;',
        '''cc = engine;
          cc.game.once("engine_inited",()=>globalThis.__stage10("engine-inited"));
          cc.game.once("game_inited",()=>globalThis.__stage10("game-inited"));
          cc.director.once(cc.Director.EVENT_AFTER_SCENE_LAUNCH,()=>{
            globalThis.__stage10("after-scene-launch");
            cc.director.once(cc.Director.EVENT_AFTER_DRAW,()=>globalThis.__stage10("first-scene-after-draw"));
          });
          cc.director.once(cc.Director.EVENT_AFTER_DRAW,()=>globalThis.__stage10("first-after-draw"));
          var priorOnStart=cc.game.onStart;
          cc.game.onStart=function(){ globalThis.__stage10("game-onStart"); if(priorOnStart) priorOnStart.apply(this,arguments); };''',
    )
    for needle, replacement in [
        ('onPostInitBase() {', 'onPostInitBase() { globalThis.__stage10("post-base-init",{isNative:cc.sys.isNative,isBrowser:cc.sys.isBrowser,platform:cc.sys.platform,hasWindow:typeof window,hasDocument:typeof document});'),
        ('onPostSystemInit() {', 'onPostSystemInit() { globalThis.__stage10("post-subsystem-init");'),
        ('start() {', 'start() { globalThis.__stage10("application-start");'),
        ('.then(() => cc.game.run());', '.then(() => { globalThis.__stage10("game-init-resolved"); return cc.game.run(); });'),
    ]:
        application = insert_once(application, needle, replacement)
    return main, application


def main() -> None:
    original = {path: path.read_bytes() for path in (MAIN, APPLICATION)}
    modified = build_probes(*(original[path].decode() for path in (MAIN, APPLICATION)))
    for path in WRITABLE.glob(EVENT_GLOB):
        path.unlink()
    before = running_pids()
    new_pids: set[int] = set()
    try:
        for path, source in zip((MAIN, APPLICATION), modified):
            path.write_text(source)
        node = shutil.which("node")
        if node:
            for path in (MAIN, APPLICATION):
                subprocess.run([node, "--check", str(path)], check=True)
        subprocess.run(["/usr/bin/open", "-n", "-a", str(APP)], check=True, timeout=15)
        time.sleep(10)
        new_pids = running_pids() - before
        print("new_pids", sorted(new_pids))
        events = [json.loads(path.read_text()) for path in sorted(WRITABLE.glob(EVENT_GLOB))]
        for event in events:
            print(json.dumps(event, ensure_ascii=False))
    finally:
        if not new_pids:
            new_pids = running_pids() - before
        for pid in new_pids:
            try:
                os.kill(pid, signal.SIGTERM)
            except ProcessLookupError:
                pass
        if new_pids:
            time.sleep(0.5)
            for pid in running_pids() & new_pids:
                try:
                    os.kill(pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
        for path, source in original.items():
            path.write_bytes(source)
        print("restored", {
            path.name: hashlib.sha256(path.read_bytes()).digest() == hashlib.sha256(source).digest()
            for path, source in original.items()
        })


if __name__ == "__main__":
    main()
