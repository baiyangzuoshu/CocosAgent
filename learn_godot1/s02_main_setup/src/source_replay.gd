# S02 Godot 1.1: legacy switches and unknown argv saved as OS main args.
extends Reference

# 教学复刻模型：转译本课 C++ 摘录中的选定数据结构、分支和状态更新。
# 不调用私有 C++；真实引擎行为由本课独立 GDScript probe 观察。

# 教学脚手架：按本课顺序组装输入、执行模型并打印观察结果。
func run():
	var parsed = _parse_args(["godot", "-path", "lesson-project", "-editor", "--course-probe"])
	print("[replay S02] project=", parsed["project"], " editor=", parsed["editor"])
	print("[replay S02] OS command-line args=", parsed["main_args"])
	print("[replay S02] setup stages=", _main_setup(parsed, true))
	print("[replay S02] missing -path value=", _parse_args(["godot", "-path"])["error"])

# C++ 对照：Main::setup 参数扫描、-path 与 main_args 分流
func _parse_args(argv):
	var state = {"project": ".", "editor": false, "main_args": [], "error": 0}
	var i = 1
	while i < argv.size():
		var arg = argv[i]
		if arg == "-path":
			if i + 1 == argv.size():
				state["error"] = 1
				break
			state["project"] = argv[i + 1]
			i += 2
		elif arg == "-editor" or arg == "-e":
			state["editor"] = true
			i += 1
		else:
			state["main_args"].append(arg)
			i += 1
	return state

# C++ 对照：Main::setup / OS::set_cmdline
func _main_setup(state, second_phase):
	if state["error"] != 0:
		return ["return error", "do not read project settings"]
	var stages = ["register core types", "parse argv", "read Globals/project settings", "OS::set_cmdline(execpath, main_args)"]
	if second_phase:
		stages.append("Main::setup2")
	return stages
