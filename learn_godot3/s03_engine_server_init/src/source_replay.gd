# S03 Godot 3.6: register service classes, then publish server singletons.
extends Reference

# 教学复刻模型：转译本课 C++ 摘录中的选定数据结构、分支和状态更新。
# 不调用私有 C++；真实引擎行为由本课独立 GDScript probe 观察。

# 教学脚手架：按本课顺序组装输入、执行模型并打印观察结果。
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

# C++ 对照：ClassDB::register_class / register_server_types
func _register_class(state, name, base, creatable):
	state["class_db"][name] = {"base": base, "creatable": creatable}

# C++ 对照：register_server_singletons / Engine::add_singleton
func _publish(state, name):
	state["engine_singletons"].append(name)

# 教学脚手架：按 Main::setup2 摘录的顺序记录阶段，不执行引擎初始化。
func _stage(state, name):
	state["stages"].append(name)
