# S03 Godot 1.1: setup2 prepares legacy Globals services before script startup.
extends Reference

func run():
	var state = {"types": {}, "globals": [], "stages": []}
	_stage(state, "initialize OS")
	_stage(state, "register_core_singletons")
	_register_type(state, "Object", "", false)
	_stage(state, "load remap and splash settings")
	_stage(state, "register_scene_types")
	_register_type(state, "Node", "Object", true)
	_stage(state, "register_server_types")
	_register_type(state, "VisualServer", "Object", false)
	_publish_global(state, "VisualServer")
	_publish_global(state, "AudioServer")
	_publish_global(state, "PhysicsServer")
	_stage(state, "register modules/drivers; ScriptServer::init_languages")
	print("[replay S03] setup2 stages=", state["stages"])
	print("[replay S03] ObjectTypeDB types=", state["types"])
	print("[replay S03] Globals singletons=", state["globals"])

func _register_type(state, name, base, has_creator):
	state["types"][name] = {"base": base, "creator": has_creator}

func _publish_global(state, name):
	if not state["globals"].has(name):
		state["globals"].append(name)

func _stage(state, name):
	state["stages"].append(name)
