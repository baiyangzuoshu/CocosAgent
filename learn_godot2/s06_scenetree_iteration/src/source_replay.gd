# Executable teaching model of selected C++ logic; not the Godot engine implementation.
extends Reference

# C++ focus: SceneTree input routing → fixed/idle queues → deferred deletion and quit.
func run():
	var state = {"paused": false, "events": [], "delete_queue": [], "quit": false}
	var nodes = [
		{"name": "Root", "input": true, "fixed": true, "idle": true, "process_when_paused": false, "delete_after_idle": false},
		{"name": "Worker", "input": false, "fixed": true, "idle": true, "process_when_paused": false, "delete_after_idle": true},
		{"name": "Overlay", "input": true, "fixed": false, "idle": true, "process_when_paused": true, "delete_after_idle": false}
	]
	_dispatch_input(state, nodes, {"handled": false})
	_process_nodes(state, nodes, "fixed", 0.02)
	_process_nodes(state, nodes, "idle", 0.016)
	state["paused"] = true
	state["events"].append("SceneTree paused: only nodes configured to process while paused remain eligible")
	_process_nodes(state, nodes, "fixed", 0.02)
	_process_nodes(state, nodes, "idle", 0.016)
	state["paused"] = false
	_flush_deferred(state)
	state["quit"] = true
	state["events"].append("SceneTree quit flag returned to MainLoop")
	for item in state["events"]:
		print("[replay S06] ", item)

func _dispatch_input(state, nodes, event):
	state["events"].append("SceneTree routes event through Viewport input")
	for node in nodes:
		if node["input"] and not event["handled"]:
			state["events"].append(node["name"] + " receives input notification")
			if node["name"] == "Overlay":
				event["handled"] = true
				state["events"].append("Overlay handles event; unhandled stage is skipped")

func _process_nodes(state, nodes, phase, delta):
	var key = "idle"
	var callback = "_process"
	if phase == "fixed":
		key = "fixed"
		if 2 <= 2:
			callback = "_fixed_process"
		else:
			callback = "_physics_process"
	for node in nodes:
		var eligible = node[key]
		if state["paused"] and not node["process_when_paused"]:
			eligible = false
		if eligible:
			state["events"].append(node["name"] + "." + callback + "(" + str(delta) + ")")
			if phase == "idle" and node["delete_after_idle"]:
				state["delete_queue"].append(node["name"])

func _flush_deferred(state):
	for name in state["delete_queue"]:
		state["events"].append("MessageQueue/delete queue frees " + name + " after callbacks")
	state["delete_queue"] = []
