# S00 Godot 2.1: generated version fields flow through OS into GDScript.
extends Reference

# 教学复刻模型：转译本课 C++ 摘录中的选定数据结构、分支和状态更新。
# 不调用私有 C++；真实引擎行为由本课独立 GDScript probe 观察。

# 教学脚手架：按本课顺序组装输入、执行模型并打印观察结果。
func run():
	var fields = {"major": 2, "minor": 1, "patch": 7, "status": "rc"}
	var macros = _generated_version_macros(fields)
	var os_dictionary = _os_engine_version(macros)
	print("[replay S00] version.py fields=", fields)
	print("[replay S00] generated macros=", macros)
	print("[replay S00] OS.get_engine_version()=", os_dictionary)
	print("[replay S00] main source areas=", ["main/", "core/", "modules/gdscript/", "scene/", "servers/ + drivers/"])

# C++ 对照：methods.py → core/version.h
func _generated_version_macros(fields):
	return {"VERSION_MAJOR": fields["major"], "VERSION_MINOR": fields["minor"], "VERSION_PATCH": fields["patch"], "VERSION_STATUS": fields["status"]}

# C++ 对照：OS::get_engine_version → _OS::get_engine_version
func _os_engine_version(macros):
	return {"major": str(macros["VERSION_MAJOR"]), "minor": str(macros["VERSION_MINOR"]), "patch": str(macros["VERSION_PATCH"]), "status": macros["VERSION_STATUS"]}
