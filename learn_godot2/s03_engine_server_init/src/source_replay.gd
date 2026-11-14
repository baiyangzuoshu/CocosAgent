# S03 Godot 2.1: ObjectTypeDB types and Globals service instances are separate tables.
extends Reference

func run():
	var state = {"types": {}, "globals": [], "stages": []}
	_stage(state, "Main::setup2: initialize OS/window")
	_stage(state, "register_core_singletons")
	_publish(state, "Input")
	_stage(state, "register_scene_types")
	_register_type(state, "Node", "Object", true)
	_stage(state, "register_server_types")
	_register_type(state, "VisualServer", "Object", false)
	_publish(state, "VisualServer")
	_publish(state, "AudioServer")
	_publish(state, "PhysicsServer")
	_stage(state, "register modules/drivers; ScriptServer::init_languages")
	print("[replay S03] stage order=", state["stages"])
	print("[replay S03] ObjectTypeDB=", state["types"])
	print("[replay S03] Globals=", state["globals"])
	print("[replay S03] type registration does not mean a singleton instance was published")

func _register_type(state, name, base, has_creator):
	state["types"][name] = {"base": base, "has_creator": has_creator}

func _publish(state, name):
	if not state["globals"].has(name):
		state["globals"].append(name)

func _stage(state, name):
	state["stages"].append(name)
