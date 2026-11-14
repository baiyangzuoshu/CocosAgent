# Executable teaching model of selected C++ logic; not the Godot engine implementation.
extends Reference

# C++ focus: Main::setup2() and the version-specific register_* functions.
func run():
	var state = {"classes": {}, "singletons": [], "stages": []}
	_stage(state, "OS initialization")
	_register_class(state, "Object", "", false)
	if 1 <= 2:
		_stage(state, "register_core_singletons")
		_publish(state, "Input")
		_stage(state, "register_scene_types")
		_register_class(state, "Node", "Object", true)
		_stage(state, "register_server_types")
		_register_class(state, "VisualServer", "Object", false)
		_publish(state, "VisualServer")
		_stage(state, "register modules/drivers and initialize ScriptServer languages")
	elif 1 == 3:
		_stage(state, "register_server_types")
		_register_class(state, "VisualServer", "Object", false)
		_stage(state, "register_scene_types")
		_register_class(state, "CanvasItem", "Node", false)
		_register_class(state, "Node2D", "CanvasItem", true)
		_stage(state, "initialize physics/navigation")
		_stage(state, "register_server_singletons")
		_publish(state, "VisualServer")
		_publish(state, "Input")
		_stage(state, "register drivers and initialize ScriptServer languages")
	else:
		_stage(state, "register_server_types at servers initialization level")
		_register_class(state, "RenderingServer", "Object", false)
		_stage(state, "register_scene_types and scene singletons")
		_register_class(state, "Node", "Object", true)
		_register_class(state, "CanvasItem", "Node", false)
		_register_class(state, "Node2D", "CanvasItem", true)
		_stage(state, "initialize physics, then register_server_singletons")
		_publish(state, "RenderingServer")
		_publish(state, "Input")
		_stage(state, "initialize ScriptServer languages")
	for item in state["stages"]:
		print("[replay S03] stage=", item)
	print("[replay S03] class table=", state["classes"])
	print("[replay S03] script singleton table=", state["singletons"])
	print("[replay S03] type registration does not create or publish every service instance")

func _register_class(state, name, base, instantiable):
	state["classes"][name] = {"base": base, "instantiable": instantiable}

func _publish(state, name):
	if not state["singletons"].has(name):
		state["singletons"].append(name)

func _stage(state, value):
	state["stages"].append(value)
