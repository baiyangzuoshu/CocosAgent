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


def probe_js(port: int, cycles: int, disable_image_bitmap: bool) -> str:
    image_bitmap_override = "cc.macro.ALLOW_IMAGE_BITMAP = false;" if disable_image_bitmap else ""
    return f'''\n(function () {{
  var seq = 0, startedAt = Date.now(), index = 0, held = null, currentStages = null;
  var base = "http://127.0.0.1:{port}/";
  {image_bitmap_override}
  function now() {{ return Date.now(); }}
  function byteLength(value) {{
    if (!value) return null;
    if (typeof value.size === "number") return value.size;
    if (typeof value.byteLength === "number") return value.byteLength;
    return null;
  }}
  function instrument(target, method, label, before, after) {{
    if (!target || typeof target[method] !== "function") return false;
    var original = target[method];
    target[method] = function () {{
      var args = Array.prototype.slice.call(arguments);
      var stage = currentStages;
      var started = now();
      if (before) before(stage, args);
      var callbackIndex = after && after.callbackIndex;
      if (callbackIndex !== undefined && typeof args[callbackIndex] === "function") {{
        var callback = args[callbackIndex];
        args[callbackIndex] = function () {{
          var callbackArgs = Array.prototype.slice.call(arguments);
          if (stage) after.finish(stage, started, callbackArgs);
          return callback.apply(this, arguments);
        }};
      }}
      var result = original.apply(this, args);
      if (after && after.sync) after.sync(stage, now() - started);
      return result;
    }};
    return true;
  }}
  function instrumentPipeline(pipeline, name) {{
    if (!pipeline || !Array.isArray(pipeline.pipes)) return false;
    pipeline.pipes = pipeline.pipes.map(function (pipe, index) {{
      var pipeName = pipe.name || ("pipe" + index);
      return function (task, done) {{
        var stage = currentStages, started = now();
        return pipe.call(this, task, function () {{
          if (stage) {{
            var finished = now();
            stage[name + "." + index + "." + pipeName + "Ms"] = finished - started;
            if (name === "loadPipeline" && index === 1) stage.loadPipelineFinishedAt = finished;
          }}
          return done.apply(this, arguments);
        }});
      }};
    }});
    return true;
  }}
  var stageHooks = {{
    downloader: instrument(cc.assetManager.downloader, "download", "download", null, {{
      callbackIndex: 4,
      finish: function (stage, started, args) {{
        stage.downloadMs = now() - started;
        stage.downloadStartOffsetMs = started - stage.requestStartedAt;
        stage.downloadBytes = byteLength(args[1]);
        stage.downloadError = args[0] ? String(args[0]) : null;
      }}
    }}),
    parser: instrument(cc.assetManager.parser, "parse", "parse", function (stage, args) {{
      if (stage) stage.parseType = args[2];
    }}, {{
      callbackIndex: 4,
      finish: function (stage, started, args) {{
        stage.parseMs = now() - started;
        stage.parseError = args[0] ? String(args[0]) : null;
      }}
    }}),
    factory: instrument(cc.assetManager.factory, "create", "create", function (stage) {{
      if (stage && stage.loadPipelineFinishedAt) {{
        stage.factoryAfterPipelineMs = now() - stage.loadPipelineFinishedAt;
      }}
    }}, {{
      callbackIndex: 4,
      finish: function (stage, started, args) {{
        stage.factoryMs = now() - started;
        stage.factoryError = args[0] ? String(args[0]) : null;
      }}
    }}),
    textureInit: instrument(cc.Texture2D.prototype, "initWithElement", "texture-init", null, {{
      sync: function (stage, elapsed) {{ if (stage) stage.textureInitMs = elapsed; }}
    }}),
    textureUpload: instrument(cc.Texture2D.prototype, "handleLoadedTexture", "texture-upload", null, {{
      sync: function (stage, elapsed) {{ if (stage) stage.textureUploadMs = elapsed; }}
    }}),
    pipeline: instrumentPipeline(cc.assetManager.pipeline, "loadPipeline"),
    fetchPipeline: instrumentPipeline(cc.assetManager.fetchPipeline, "fetchPipeline"),
    transformPipeline: instrumentPipeline(cc.assetManager.transformPipeline, "transformPipeline")
  }};
  var schedulerStartedAt = now();
  setTimeout(function () {{
    write("scheduler", {{setTimeoutZeroMs:now() - schedulerStartedAt}});
  }}, 0);
  if (typeof Promise === "function") {{
    var microtaskStartedAt = now();
    Promise.resolve().then(function () {{
      write("scheduler", {{promiseMicrotaskMs:now() - microtaskStartedAt}});
    }});
  }}
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
      imageBitmapCapability:!!cc.sys.capabilities.imageBitmap,
      allowImageBitmap:cc.macro.ALLOW_IMAGE_BITMAP,
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
      currentStages = {{cycle:cycle, color:color}};
      var requestAt = now();
      currentStages.requestStartedAt = requestAt;
      cc.assetManager.loadRemote(url, {{ext:".png"}}, function (err, texture) {{
        if (err) {{ write("load-error", {{cycle:cycle, message:String(err)}}); return finish(); }}
        var loadCompletedAt = now();
        var loadMs = loadCompletedAt - requestAt;
        texture.addRef();
        var previous = held;
        held = texture;
        if (previous) previous.decRef();
        cc.assetManager.releaseUnusedAssets();
        setTimeout(function () {{
          write("swap", {{cycle:cycle, color:color, loadMs:loadMs,
            postLoadHoldMs:now()-loadCompletedAt,
            width:texture.width, height:texture.height, refCount:texture.refCount,
            previousValid:previous&&cc.isValid(previous), assetCacheCount:cacheCount(),
            stages:currentStages, stageHooks:stageHooks,
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
    parser.add_argument("--disable-image-bitmap", action="store_true",
                        help="force the legacy native Image path instead of ImageBitmap")
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
    modified = source.replace(needle, needle + probe_js(port, args.cycles, args.disable_image_bitmap), 1)
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
            "disableImageBitmap": args.disable_image_bitmap,
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
