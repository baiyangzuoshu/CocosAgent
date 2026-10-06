"""Exercise local WebSocket echo, TCP reset, or rejected handshake in two Mac apps.

The server only listens on 127.0.0.1. Generated scripts are restored byte for
byte, and temporary result files and newly launched 3.x processes are removed.
"""

from __future__ import annotations

import base64
import hashlib
import json
import os
from pathlib import Path
import re
import signal
import socket
import socketserver
import struct
import subprocess
import sys
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
GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
BINARY_BYTES = [0, 1, 127, 128, 255]


def replace_once(source: str, needle: str, replacement: str) -> str:
    if source.count(needle) != 1:
        raise ValueError(f"expected one {needle!r}, got {source.count(needle)}")
    return source.replace(needle, replacement, 1)


def read_exact(connection: socket.socket, length: int) -> bytes:
    chunks = []
    while length:
        chunk = connection.recv(length)
        if not chunk:
            raise EOFError("socket closed before frame ended")
        chunks.append(chunk)
        length -= len(chunk)
    return b"".join(chunks)


def send_frame(connection: socket.socket, opcode: int, payload: bytes = b"") -> None:
    header = bytes([0x80 | opcode])
    if len(payload) < 126:
        header += bytes([len(payload)])
    elif len(payload) < 65536:
        header += bytes([126]) + struct.pack("!H", len(payload))
    else:
        raise ValueError("probe payload too large")
    connection.sendall(header + payload)


class EchoHandler(socketserver.BaseRequestHandler):
    def handle(self) -> None:
        connection = self.request
        connection.settimeout(8)
        data = b""
        while b"\r\n\r\n" not in data and len(data) < 16384:
            part = connection.recv(4096)
            if not part:
                raise EOFError("handshake disconnected")
            data += part
        header, remaining = data.split(b"\r\n\r\n", 1)
        lines = header.decode("latin-1").split("\r\n")
        fields = dict(line.split(":", 1) for line in lines[1:] if ":" in line)
        key = next((value.strip() for name, value in fields.items()
                    if name.lower() == "sec-websocket-key"), None)
        if not key:
            raise ValueError("missing WebSocket key")
        if self.server.mode == "reject-handshake":
            self.server.events.append({"kind": "handshake-request", "path": lines[0].split()[1]})
            connection.sendall(b"HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\nConnection: close\r\n\r\n")
            self.server.events.append({"kind": "http-reject", "status": 403})
            return
        accept = base64.b64encode(hashlib.sha1((key + GUID).encode()).digest()).decode()
        connection.sendall(("HTTP/1.1 101 Switching Protocols\r\n"
                            "Upgrade: websocket\r\nConnection: Upgrade\r\n"
                            f"Sec-WebSocket-Accept: {accept}\r\n\r\n").encode())
        self.server.events.append({"kind": "handshake", "path": lines[0].split()[1]})

        # A frame may follow the handshake in the same TCP packet.
        pending = bytearray(remaining)

        def take(length: int) -> bytes:
            nonlocal pending
            while len(pending) < length:
                pending.extend(read_exact(connection, length - len(pending)))
            out = bytes(pending[:length])
            del pending[:length]
            return out

        while True:
            first, second = take(2)
            opcode = first & 0x0F
            length = second & 0x7F
            if length == 126:
                length = struct.unpack("!H", take(2))[0]
            elif length == 127:
                length = struct.unpack("!Q", take(8))[0]
            if length > 16384:
                raise ValueError("unexpected large WebSocket frame")
            mask = take(4) if second & 0x80 else b""
            body = take(length)
            if mask:
                body = bytes(byte ^ mask[index % 4] for index, byte in enumerate(body))
            if opcode == 1:
                value = body.decode("utf-8")
                self.server.events.append({"kind": "text", "text": value})
                if self.server.mode == "drop-after-text":
                    # Abort TCP without sending a WebSocket close frame.
                    self.server.events.append({"kind": "tcp-reset"})
                    connection.setsockopt(socket.SOL_SOCKET, socket.SO_LINGER,
                                          struct.pack("ii", 1, 0))
                    connection.close()
                    return
                send_frame(connection, 1, body)
            elif opcode == 2:
                self.server.events.append({"kind": "binary", "bytes": list(body)})
                send_frame(connection, 2, body)
            elif opcode == 8:
                code = struct.unpack("!H", body[:2])[0] if len(body) >= 2 else None
                self.server.events.append({"kind": "close", "code": code})
                send_frame(connection, 8, body or struct.pack("!H", 1000))
                return
            elif opcode == 9:
                send_frame(connection, 10, body)
            else:
                self.server.events.append({"kind": "other-frame", "opcode": opcode})


class EchoServer(socketserver.ThreadingTCPServer):
    daemon_threads = True
    allow_reuse_address = True

    def __init__(self, mode: str = "echo"):
        super().__init__(("127.0.0.1", 0), EchoHandler)
        self.events: list[dict] = []
        self.mode = mode


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


def run_2x(url: str, message: str, binary: bool = False) -> list[dict]:
    original = MAIN2.read_bytes()
    js = '''(function(){
      var events=[];
      var emit=function(kind,extra){var event={version:'2.4.15',kind:kind,
        isNative:cc.sys.isNative,isBrowser:cc.sys.isBrowser};
        if(extra){for(var name in extra){event[name]=extra[name];}}
        events.push(event);console.log('STAGE11_WS '+JSON.stringify(event));};
      emit('api',{type:typeof WebSocket,jsbType:typeof jsb.WebSocket});
      try{var ws=new WebSocket(URL_HERE);
        if(BINARY_HERE){ws.binaryType='arraybuffer';}
        ws.onopen=function(){emit('open',{readyState:ws.readyState});
          ws.send(BINARY_HERE ? new Uint8Array(BYTES_HERE).buffer : MESSAGE_HERE);};
        ws.onmessage=function(event){
          var info={readyState:ws.readyState,dataType:Object.prototype.toString.call(event.data)};
          if(BINARY_HERE){if(event.data instanceof ArrayBuffer){
            var view=new Uint8Array(event.data), bytes=[];
            for(var i=0;i<view.length;i++){bytes.push(view[i]);}
            info.bytes=bytes;
          }else{info.data=String(event.data);}}
          else{info.data=String(event.data);}
          emit('message',info);ws.close();};
        ws.onerror=function(event){emit('error',{eventType:event&&event.type,readyState:ws.readyState});};
        ws.onclose=function(event){emit('close',{code:event&&event.code,
          wasClean:event&&event.wasClean,readyState:ws.readyState});};
      }catch(error){emit('exception',{error:String(error)});}
    })();'''.replace("URL_HERE", json.dumps(url)).replace("MESSAGE_HERE", json.dumps(message))
    js = js.replace("BINARY_HERE", json.dumps(binary)).replace("BYTES_HERE", json.dumps(BINARY_BYTES))
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
        matches = re.findall(r"STAGE11_WS (\{[^\r\n]+\})", output)
        if not matches:
            raise RuntimeError(f"2.4: no WebSocket events; output tail: {output[-1400:]}")
        return [json.loads(match) for match in matches]
    finally:
        MAIN2.write_bytes(original)
        if MAIN2.read_bytes() != original:
            raise RuntimeError("2.4 main.js restore failed")
        print("2.4 restored", hashlib.sha256(original).hexdigest())


def run_3x(url: str, message: str, token: str, binary: bool = False) -> list[dict]:
    original = APPLICATION3.read_bytes()
    name = f"cocos-stage11-ws-{token}.json"
    result_path = WRITABLE3 / name
    js = '''(function(){
      var events=[];
      var emit=function(kind,extra){var event={version:'3.8.7',kind:kind,
        isNative:cc.sys.isNative,isBrowser:cc.sys.isBrowser};
        if(extra){for(var name in extra){event[name]=extra[name];}}
        events.push(event);jsb.fileUtils.writeStringToFile(JSON.stringify(events),
          jsb.fileUtils.getWritablePath()+NAME_HERE);};
      emit('api',{type:typeof WebSocket,jsbType:typeof jsb.WebSocket});
      try{var ws=new WebSocket(URL_HERE);
        if(BINARY_HERE){ws.binaryType='arraybuffer';}
        ws.onopen=function(){emit('open',{readyState:ws.readyState});
          ws.send(BINARY_HERE ? new Uint8Array(BYTES_HERE).buffer : MESSAGE_HERE);};
        ws.onmessage=function(event){
          var info={readyState:ws.readyState,dataType:Object.prototype.toString.call(event.data)};
          if(BINARY_HERE){if(event.data instanceof ArrayBuffer){
            var view=new Uint8Array(event.data), bytes=[];
            for(var i=0;i<view.length;i++){bytes.push(view[i]);}
            info.bytes=bytes;
          }else{info.data=String(event.data);}}
          else{info.data=String(event.data);}
          emit('message',info);ws.close();};
        ws.onerror=function(event){emit('error',{eventType:event&&event.type,readyState:ws.readyState});};
        ws.onclose=function(event){emit('close',{code:event&&event.code,
          wasClean:event&&event.wasClean,readyState:ws.readyState});};
      }catch(error){emit('exception',{error:String(error)});}
    })();'''.replace("NAME_HERE", json.dumps(name)).replace("URL_HERE", json.dumps(url)).replace("MESSAGE_HERE", json.dumps(message))
    js = js.replace("BINARY_HERE", json.dumps(binary)).replace("BYTES_HERE", json.dumps(BINARY_BYTES))
    before = app3_pids()
    new_pids: set[int] = set()
    result_path.unlink(missing_ok=True)
    try:
        APPLICATION3.write_text(replace_once(original.decode(), "onPostInitBase() {",
                                             "onPostInitBase() {" + js))
        subprocess.run(["node", "--check", str(APPLICATION3)], check=True, capture_output=True)
        subprocess.run(["/usr/bin/open", "-n", "-a", str(APP3)], check=True, timeout=15)
        events: list[dict] = []
        for _ in range(55):
            if result_path.exists():
                events = json.loads(result_path.read_text())
                if events and events[-1]["kind"] in ("close", "exception"):
                    break
            time.sleep(0.2)
        new_pids = app3_pids() - before
        if not events:
            raise RuntimeError("3.8: no WebSocket events")
        return events
    finally:
        stop_app3(new_pids or (app3_pids() - before))
        result_path.unlink(missing_ok=True)
        APPLICATION3.write_bytes(original)
        if APPLICATION3.read_bytes() != original:
            raise RuntimeError("3.8 application.js restore failed")
        print("3.8 restored", hashlib.sha256(original).hexdigest())


def main() -> None:
    if sys.argv[1:] not in ([], ["--drop-after-text"], ["--binary-echo"], ["--reject-handshake"]):
        raise SystemExit("usage: stage11-mac-websocket.py [--drop-after-text|--binary-echo|--reject-handshake]")
    mode = {(): "echo", ("--drop-after-text",): "drop-after-text",
            ("--binary-echo",): "binary-echo",
            ("--reject-handshake",): "reject-handshake"}[tuple(sys.argv[1:])]
    token = uuid.uuid4().hex
    server = EchoServer(mode)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base = f"ws://127.0.0.1:{server.server_address[1]}/stage11"
    try:
        for version, runner in (("2.4.15", run_2x), ("3.8.7", run_3x)):
            message = f"stage11-{version}-{token}"
            url = f"{base}/{version}?token={token}"
            before = len(server.events)
            binary = mode == "binary-echo"
            events = runner(url, message, binary) if version == "2.4.15" else runner(url, message, token, binary)
            server_events = server.events[before:]
            if mode == "reject-handshake":
                if not any(event.get("kind") == "http-reject" and event.get("status") == 403 for event in server_events):
                    raise RuntimeError(f"{version}: server did not reject handshake: {server_events}")
            elif binary:
                if not any(event.get("kind") == "binary" and event.get("bytes") == BINARY_BYTES for event in server_events):
                    raise RuntimeError(f"{version}: server did not receive expected binary: {server_events}")
            elif not any(event.get("kind") == "text" and event.get("text") == message for event in server_events):
                raise RuntimeError(f"{version}: server did not receive expected text: {server_events}")
            suffix = {"echo": "websocket", "drop-after-text": "websocket-abrupt",
                      "binary-echo": "websocket-binary",
                      "reject-handshake": "websocket-rejected-handshake"}[mode]
            path = TRACES / f"{version}-stage11-mac-native-{suffix}.jsonl"
            path.write_text("\n".join(json.dumps(event, ensure_ascii=False) for event in events) + "\n")
            print("trace", path)
            server_path = TRACES / f"{version}-stage11-mac-native-{suffix}-server.jsonl"
            server_path.write_text("\n".join(json.dumps(event, ensure_ascii=False) for event in server_events) + "\n")
            print("server_trace", server_path)
            for event in events:
                print(json.dumps(event, ensure_ascii=False))
            print("server_events", json.dumps(server_events, ensure_ascii=False))
            kinds = [event["kind"] for event in events]
            if mode == "echo":
                if kinds != ["api", "open", "message", "close"] or events[2].get("data") != message:
                    raise RuntimeError(f"{version}: incomplete WebSocket echo lifecycle: {events}")
            elif binary:
                if kinds != ["api", "open", "message", "close"] or events[2].get("bytes") != BINARY_BYTES:
                    raise RuntimeError(f"{version}: incomplete WebSocket binary lifecycle: {events}")
            elif mode == "reject-handshake":
                if kinds[0] != "api" or "open" in kinds or not any(kind in kinds for kind in ("error", "close")):
                    raise RuntimeError(f"{version}: unexpected rejected-handshake events: {events}")
            elif kinds[:2] != ["api", "open"] or not any(kind in kinds for kind in ("error", "close")):
                raise RuntimeError(f"{version}: missing abnormal-close event: {events}")
    finally:
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    main()
