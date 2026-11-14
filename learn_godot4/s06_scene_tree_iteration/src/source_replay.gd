# S06 Godot 4.7: SceneTree process groups divide physics and idle callbacks.
extends RefCounted

func run():
	var groups = [
		{"name": "Player", "order": 0, "thread": "main", "physics": true, "idle": true},
		{"name": "Worker", "order": 0, "thread": "sub-thread", "physics": true, "idle": true},
		{"name": "Hud", "order": 10, "thread": "main", "physics": false, "idle": true}
	]
	var state = {"events": [], "quit": false}
	_scene_tree_physics(state, groups, 0.02)
	_scene_tree_process(state, groups, 0.016)
	state["quit"] = true
	state["events"].append("SceneTree::quit sets _quit; finalize tears down tree")
	for event in state["events"]:
		print("[replay S06] ", event)

func _scene_tree_physics(state, groups, delta):
	state["events"].append("physics_frame signal")
	_process_groups(state, groups, "physics", "physics_process", delta)
	state["events"].append("physics Timer/Tween and delete queue")

func _scene_tree_process(state, groups, delta):
	state["events"].append("process_frame signal")
	_process_groups(state, groups, "idle", "process", delta)
	state["events"].append("scene switch, timers, tweens, transforms and idle callbacks")

func _process_groups(state, groups, key, phase, delta):
	var ordered = _sort_groups(groups)
	for group in ordered:
		if group[key]:
			state["events"].append(group["name"] + " order=" + str(group["order"]) + " thread=" + group["thread"] + " " + phase + "(" + str(delta) + ")")

func _sort_groups(groups):
	var ordered = []
	for group in groups:
		var index = 0
		while index < ordered.size() and ordered[index]["order"] <= group["order"]:
			index += 1
		ordered.insert(index, group)
	return ordered
