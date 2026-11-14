# S06 Godot 1.1: SceneTree sends fixed/idle groups and routes handled input.
extends Reference

func run():
	var nodes = [
		{"name": "Root", "fixed": true, "idle": true, "input": true},
		{"name": "Worker", "fixed": true, "idle": false, "input": false},
		{"name": "Overlay", "fixed": false, "idle": true, "input": true}
	]
	var state = {"events": [], "quit": false}
	_route_input(state, nodes, false)
	_process_group(state, nodes, "fixed", "NOTIFICATION_FIXED_PROCESS", 0.02)
	_process_group(state, nodes, "idle", "NOTIFICATION_PROCESS", 0.016)
	state["quit"] = true
	state["events"].append("SceneTree::quit sets _quit; return to platform loop")
	for event in state["events"]:
		print("[replay S06] ", event)

func _route_input(state, nodes, handled):
	state["events"].append("MainLoop::input_event forwards event to Viewport")
	for node in nodes:
		if node["input"] and not handled:
			state["events"].append(node["name"] + " receives Viewport input")
			if node["name"] == "Overlay":
				handled = true
				state["events"].append("Viewport marks event handled; unhandled route stops")

func _process_group(state, nodes, phase, notification, delta):
	for node in nodes:
		if node[phase]:
			state["events"].append(node["name"] + " receives " + notification + "(" + str(delta) + ")")
