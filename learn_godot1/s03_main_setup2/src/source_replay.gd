# S03 Godot 1.1: setup2 prepares legacy Globals services before script startup.
extends Reference

# 教学复刻模型：转译本课 C++ 摘录中的选定数据结构、分支和状态更新。
# 不调用私有 C++；真实引擎行为由本课独立 GDScript probe 观察。

# 教学脚手架：按本课顺序组装输入、执行模型并打印观察结果。
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

# C++ 对照：ObjectTypeDB::register_type
func _register_type(state, name, base, has_creator):
	state["types"][name] = {"base": base, "creator": has_creator}

# C++ 对照：register_server_types / Globals::add_singleton
func _publish_global(state, name):
	if not state["globals"].has(name):
		state["globals"].append(name)

# 教学脚手架：按 Main::setup2 摘录的顺序记录阶段，不执行引擎初始化。
func _stage(state, name):
	state["stages"].append(name)
