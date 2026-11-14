# S00 Godot 1.1: version.py → generated build macros → old script surface.
extends Reference

# 教学复刻模型：转译本课 C++ 摘录中的选定数据结构、分支和状态更新。
# 不调用私有 C++；真实引擎行为由本课独立 GDScript probe 观察。

# 教学脚手架：按本课顺序组装输入、执行模型并打印观察结果。
func run():
	var fields = _snapshot_fields()
	var macros = _generated_version_macros(fields)
	print("[replay S00] source fields=", fields)
	print("[replay S00] generated version macros=", macros)
	print("[replay S00] script query=", _script_version_query())
	print("[replay S00] source areas=", _source_areas())

# C++ 对照：version.py
func _snapshot_fields():
	return {"major": 1, "minor": 1, "status": "stable"}

# C++ 对照：methods.py → core/typedefs.h
func _generated_version_macros(fields):
	return {"VERSION_MAJOR": fields["major"], "VERSION_MINOR": fields["minor"], "VERSION_STATUS": fields["status"]}

# C++ 对照：core/os/os.cpp / core/bind/core_bind.cpp（本代没有版本查询 API）
func _script_version_query():
	return "Godot 1.1 does not bind Engine.get_version_info or OS.get_engine_version; use the executable/editor label."

# C++ 对照：课程导航，不对应单一 C++ 函数
func _source_areas():
	return ["main/: entry and Main::iteration", "core/: Object, Variant and OS", "scene/: SceneTree and Node", "servers/ + drivers/: server interface and backend", "platform/: native startup"]
