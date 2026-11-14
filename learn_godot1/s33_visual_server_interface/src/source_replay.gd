extends Reference

# VisualServer::get_singleton → VisualServerRaster implementation → draw request
var state = {}

func run_model():
	print("[S33 replay Godot 1] VisualServer 如何隔离场景节点和渲染后端")
	state = {"interface": "VisualServer", "implementation": "VisualServerRaster", "draw_seen": false}
	_get_server()
	_draw_request()
	_backend_draw()

func _get_server():
	print("[server singleton] ", state["interface"])

func _draw_request():
	state["draw_seen"] = true
	print("[public interface] draw request forwarded to implementation")

func _backend_draw():
	print("[implementation] ", state["implementation"], " received=", state["draw_seen"])
