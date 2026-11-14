# S03 Godot 4.7: ClassDB registration precedes service singleton publication.
extends RefCounted

func run():
	var state = {"class_db": {}, "engine_singletons": [], "stages": []}
	_stage(state, "Main::setup2 starts second initialization phase")
	_stage(state, "register_server_types")
	_register_class(state, "RenderingServer", "Object", false)
	_register_class(state, "PhysicsServer3D", "Object", false)
	_stage(state, "initialize navigation and server implementations")
	_stage(state, "register_scene_types and scene singletons")
	_register_class(state, "Node", "Object", true)
	_register_class(state, "Node2D", "CanvasItem", true)
	_stage(state, "initialize physics; register_server_singletons")
	_publish(state, "RenderingServer")
	_publish(state, "PhysicsServer3D")
	_stage(state, "ScriptServer::init_languages")
	print("[replay S03] stages=", state["stages"])
	print("[replay S03] ClassDB types=", state["class_db"])
	print("[replay S03] Engine singletons=", state["engine_singletons"])

func _register_class(state, name, base, creatable):
	state["class_db"][name] = {"base": base, "creatable": creatable}

func _publish(state, singleton_name):
	if not state["engine_singletons"].has(singleton_name):
		state["engine_singletons"].append(singleton_name)

func _stage(state, name):
	state["stages"].append(name)
