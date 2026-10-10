"""Measure 2.4.15 Mac-native remote texture replacement and process RSS."""

from __future__ import annotations

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import hashlib
import json
from pathlib import Path
import re
import select
import signal
import struct
import subprocess
import time
import zlib


ROOT = Path(__file__).resolve().parents[3]
APP = ROOT / "2.4.15NewProject/build/jsb-link/publish/mac/hello_world-desktop.app"
ENTRY = APP / "Contents/Resources/main.js"
EXECUTABLE = APP / "Contents/MacOS/hello_world-desktop"
TRACE_DIR = ROOT / "docs/agent-foundation/traces"
PREFIX = "cocos-native-content-stress-2.4-"


def png_chunk(kind: bytes, data: bytes) -> bytes:
    body = kind + data
    return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)


def solid_png(size: int, rgba: tuple[int, int, int, int]) -> bytes:
    row = b"\x00" + bytes(rgba) * size
    raw = row * size
    return (
        b"\x89PNG\r\n\x1a\n"
        + png_chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
        + png_chunk(b"IDAT", zlib.compress(raw, level=1))
        + png_chunk(b"IEND", b"")
    )


def probe_js(port: int, cycles: int) -> str:
    return f'''\n(function () {{
  var seq = 0, startedAt = Date.now(), index = 0, held = null;
  var base = "http://127.0.0.1:{port}/";
  function write(phase, extra) {{
    var item = {{version:"2.4.15", phase:phase, seq:++seq, elapsedMs:Date.now()-startedAt,
      extra:extra||{{}}}};
    var json = JSON.stringify(item);
    console.log("COCOS_NATIVE_CONTENT_STRESS", json);
  }}
  function cacheCount() {{
    var cache = cc.assetManager.assets;
    return cache && (cache.count !== undefined ? cache.count : cache._map && Object.keys(cache._map).length);
  }}
  cc.director.once(cc.Director.EVENT_AFTER_SCENE_LAUNCH, function () {{
    write("started", {{isNative:cc.sys.isNative, scene:cc.director.getScene().name,
      bridgeAvailable:!!(jsb && jsb.getProcessMemoryInfo), assetCacheCount:cacheCount()}});
    function finish() {{
      if (held) held.decRef();
      cc.assetManager.releaseUnusedAssets();
      setTimeout(function () {{
        write("cleanup", {{heldValid:held&&cc.isValid(held), assetCacheCount:cacheCount(),
          nativeMemory:jsb.getProcessMemoryInfo ? jsb.getProcessMemoryInfo() : null}});
      }}, 350);
    }}
    function next() {{
      if (index >= {cycles}) return finish();
      var cycle = index++, color = cycle % 2 ? "blue" : "red";
      var url = base + color + ".png?cycle=" + cycle;
      var requestAt = Date.now();
      cc.assetManager.loadRemote(url, {{ext:".png"}}, function (err, texture) {{
        if (err) {{ write("load-error", {{cycle:cycle, message:String(err)}}); return finish(); }}
        texture.addRef();
        var previous = held;
        held = texture;
        if (previous) previous.decRef();
        cc.assetManager.releaseUnusedAssets();
        setTimeout(function () {{
          write("swap", {{cycle:cycle, color:color, loadMs:Date.now()-requestAt,
            width:texture.width, height:texture.height, refCount:texture.refCount,
            previousValid:previous&&cc.isValid(previous), assetCacheCount:cacheCount(),
            nativeMemory:jsb.getProcessMemoryInfo ? jsb.getProcessMemoryInfo() : null}});
          next();
        }}, 80);
      }});
    }}
    next();
  }});
}})();\n'''


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--cycles", type=int, default=24)
    parser.add_argument("--size", type=int, default=1024)
    parser.add_argument("--app-path", type=Path, default=APP)
    args = parser.parse_args()
    if args.cycles < 2 or args.size < 16:
        raise SystemExit("cycles must be >=2 and size must be >=16")

    red = solid_png(args.size, (230, 32, 32, 255))
    blue = solid_png(args.size, (32, 64, 230, 255))
    responses = {"/red.png": red, "/blue.png": blue}

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):  # noqa: N802 - BaseHTTPRequestHandler API
            payload = responses.get(self.path.split("?", 1)[0])
            if payload is None:
                self.send_error(404)
                return
            self.send_response(200)
            self.send_header("Content-Type", "image/png")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)

        def log_message(self, *_args):
            pass

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    port = server.server_address[1]
    import threading

    server_thread = threading.Thread(target=server.serve_forever, daemon=True)
    server_thread.start()

    app = args.app_path.resolve()
    entry = app / "Contents/Resources/main.js"
    executable = app / "Contents/MacOS/hello_world-desktop"
    if not entry.is_file() or not executable.is_file():
        server.shutdown()
        raise SystemExit(f"Expected a built Creator 2.4 Mac app at {app}")
    original = entry.read_bytes()
    source = original.decode("utf-8")
    needle = "window.boot = function () {"
    if source.count(needle) != 1:
        server.shutdown()
        raise RuntimeError(f"Expected one boot hook; found {source.count(needle)}")
    modified = source.replace(needle, needle + probe_js(port, args.cycles), 1)
    process = None
    rss_samples = []
    started_wall = time.time()
    try:
        entry.write_text(modified)
        subprocess.run(["node", "--check", str(entry)], check=True)
        process = subprocess.Popen(
            [str(executable)], cwd=entry.parent, stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
        )
        deadline = time.monotonic() + 30
        output_lines = []
        while time.monotonic() < deadline:
            result = subprocess.run(
                ["/bin/ps", "-axo", "pid=,rss=,command="],
                capture_output=True, text=True,
            )
            for process_line in result.stdout.splitlines():
                fields = process_line.strip().split(None, 2)
                if len(fields) == 3 and str(executable) in fields[2] and fields[1].isdigit():
                    rss_samples.append({"elapsedMs": int((time.time() - started_wall) * 1000),
                                        "pid": int(fields[0]), "rssBytes": int(fields[1]) * 1024})
            ready, _, _ = select.select([process.stdout], [], [], 0.05)
            if ready:
                line = process.stdout.readline()
                if line:
                    output_lines.append(line.decode(errors="replace"))
                    if '"phase":"cleanup"' in output_lines[-1]:
                        break
            if process.poll() is not None:
                break
        if process.poll() is None:
            process.send_signal(signal.SIGTERM)
        output, _ = process.communicate(timeout=5)
        output_lines.append(output.decode(errors="replace"))
        records = [json.loads(match) for match in re.findall(
            r"COCOS_NATIVE_CONTENT_STRESS (\{[^\r\n]+\})", "".join(output_lines))]
        phases = [record["phase"] for record in records]
        if phases.count("swap") != args.cycles or phases[-1] != "cleanup":
            raise RuntimeError(f"Incomplete native trace: {phases}")
        tested_at = time.strftime("%Y%m%dT%H%M%S", time.gmtime())
        trace_path = TRACE_DIR / f"{PREFIX}{tested_at}.jsonl"
        rss_path = TRACE_DIR / f"{PREFIX}{tested_at}-rss.json"
        trace_path.write_text("".join(json.dumps(item, ensure_ascii=False) + "\n" for item in records))
        rss_path.write_text(json.dumps({
            "version": "2.4.15", "platform": "macOS native", "cycles": args.cycles,
            "textureSize": args.size, "pngBytes": {"red": len(red), "blue": len(blue)},
            "rssSamples": rss_samples,
        }, ensure_ascii=False, indent=2) + "\n")
        print(json.dumps({"trace": str(trace_path), "rssTrace": str(rss_path),
                          "events": len(records), "rssSampleCount": len(rss_samples),
                          "rssMinBytes": min((x["rssBytes"] for x in rss_samples), default=None),
                          "rssMaxBytes": max((x["rssBytes"] for x in rss_samples), default=None)},
                         ensure_ascii=False))
    finally:
        if process is not None and process.poll() is None:
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=5)
        entry.write_bytes(original)
        server.shutdown()
        print("restored", hashlib.sha256(entry.read_bytes()).digest() == hashlib.sha256(original).digest())


if __name__ == "__main__":
    main()
