# S03 Godot 4.7: ClassDB registration precedes service singleton publication.
extends RefCounted

# 教学复刻模型：转译本课 C++ 摘录中的选定数据结构、分支和状态更新。
# 不调用私有 C++；真实引擎行为由本课独立 GDScript probe 观察。

# 教学脚手架：按本课顺序组装输入、执行模型并打印观察结果。
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

# C++ 对照：ClassDB::register_class / register_server_types
func _register_class(state, name, base, creatable):
	state["class_db"][name] = {"base": base, "creatable": creatable}

# C++ 对照：register_server_singletons / Engine::add_singleton
func _publish(state, singleton_name):
	if not state["engine_singletons"].has(singleton_name):
		state["engine_singletons"].append(singleton_name)

# 教学脚手架：按 Main::setup2 摘录的顺序记录阶段，不执行引擎初始化。
func _stage(state, name):
	state["stages"].append(name)
