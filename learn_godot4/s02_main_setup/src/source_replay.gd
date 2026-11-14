# S02 Godot 4.7: setup separates engine main_args from args after -- or ++.
extends RefCounted

# 教学复刻模型：转译本课 C++ 摘录中的选定数据结构、分支和状态更新。
# 不调用私有 C++；真实引擎行为由本课独立 GDScript probe 观察。

# 教学脚手架：按本课顺序组装输入、执行模型并打印观察结果。
func run():
	var parsed = _parse_args(["godot", "--editor", "--", "--course-probe"])
	print("[replay S02] editor=", parsed["editor"], " main_args=", parsed["main_args"], " user_args=", parsed["user_args"])
	print("[replay S02] setup stages=", _setup(parsed, true))
	print("[replay S02] separator ++ also begins user args=", _parse_args(["godot", "++", "x"])["user_args"])
	print("[replay S02] --path is build-option gated in this snapshot; experiment uses current project path")

# C++ 对照：Main::setup args/main_args/user_args 分区
func _parse_args(argv):
	var state = {"editor": false, "main_args": [], "user_args": [], "user_mode": false, "error": 0}
	var i = 1
	while i < argv.size():
		var arg = argv[i]
		if arg == "--" or arg == "++":
			state["user_mode"] = true
			i += 1
		elif state["user_mode"]:
			state["user_args"].append(arg)
			i += 1
		elif arg == "--editor":
			state["editor"] = true
			i += 1
		elif arg == "--path":
			state["error"] = 2
			return state
		else:
			state["main_args"].append(arg)
			i += 1
	return state

# C++ 对照：Main::setup → ProjectSettings → OS::set_cmdline → setup2
func _setup(parsed, second_phase):
	var stages = ["initialize OS and core types", "scan args into main_args/user_args", "load project settings", "OS::set_cmdline(main_args, user_args)"]
	if parsed["error"] != 0:
		stages.append("OVERRIDE_PATH_ENABLED is disabled: reject --path")
	elif second_phase:
		stages.append("Main::setup2")
	return stages
