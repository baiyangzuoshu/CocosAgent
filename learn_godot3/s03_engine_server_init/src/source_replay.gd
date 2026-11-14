# S03 Godot 3.6: register service classes, then publish server singletons.
extends Reference

func run():
	var state = {"class_db": {}, "engine_singletons": [], "stages": []}
	_stage(state, "Main::setup2: initialize platform/core services")
	_register_class(state, "VisualServer", "Object", false)
	_stage(state, "register_server_types")
	_register_class(state, "Physics2DServer", "Object", false)
	_register_class(state, "PhysicsServer", "Object", false)
	_stage(state, "register_scene_types")
	_register_class(state, "Node", "Object", true)
	_register_class(state, "CanvasItem", "Node", false)
	_register_class(state, "Node2D", "CanvasItem", true)
	_stage(state, "initialize physics/navigation")
	_publish(state, "VisualServer")
	_publish(state, "Physics2DServer")
	_publish(state, "PhysicsServer")
	_stage(state, "register_server_singletons; initialize ScriptServer languages")
	print("[replay S03] stages=", state["stages"])
	print("[replay S03] ClassDB names=", state["class_db"].keys())
	print("[replay S03] Engine singletons=", state["engine_singletons"])
	print("[replay S03] class_exists != singleton-published")

func _register_class(state, name, base, creatable):
	state["class_db"][name] = {"base": base, "creatable": creatable}

func _publish(state, name):
	state["engine_singletons"].append(name)

func _stage(state, name):
	state["stages"].append(name)
