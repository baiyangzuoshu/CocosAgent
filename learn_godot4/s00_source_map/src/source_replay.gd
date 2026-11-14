# S00 Godot 4.7: build version macros → Engine singleton → GDScript dictionary.
extends RefCounted

# 教学复刻模型：转译本课 C++ 摘录中的选定数据结构、分支和状态更新。
# 不调用私有 C++；真实引擎行为由本课独立 GDScript probe 观察。

# 教学脚手架：按本课顺序组装输入、执行模型并打印观察结果。
func run():
	var source = {"major": 4, "minor": 7, "patch": 3, "status": "rc", "build": "custom_build"}
	var macros = _build_version_macros(source)
	var native_info = _engine_get_version_info(macros)
	print("[replay S00] version.py=", source)
	print("[replay S00] generated build fields=", macros)
	print("[replay S00] Engine.get_version_info() model=", native_info)
	print("[replay S00] follow-up source areas=", ["main/", "core/object/ + core/variant/", "scene/", "servers/rendering/", "drivers/", "platform/"])

# C++ 对照：methods.py → core/core_builders.py → version_generated.gen.h
func _build_version_macros(source):
	return {"VERSION_MAJOR": source["major"], "VERSION_MINOR": source["minor"], "VERSION_PATCH": source["patch"], "VERSION_STATUS": source["status"], "VERSION_BUILD": source["build"]}

# C++ 对照：Engine::get_version_info → CoreBind → Engine singleton
func _engine_get_version_info(macros):
	return {"major": macros["VERSION_MAJOR"], "minor": macros["VERSION_MINOR"], "patch": macros["VERSION_PATCH"], "status": macros["VERSION_STATUS"], "build": macros["VERSION_BUILD"]}
