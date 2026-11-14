# S01 Godot 3.6: macOS native entry → Main setup/start → OS run.
extends Reference

# 教学复刻模型：转译本课 C++ 摘录中的选定数据结构、分支和状态更新。
# 不调用私有 C++；真实引擎行为由本课独立 GDScript probe 观察。

# 教学脚手架：按本课顺序组装输入、执行模型并打印观察结果。
func run():
	var state = _new_run()
	_platform_main(state, 0, 0)
	_print_trace("success", state)
	var setup_failed = _new_run()
	_platform_main(setup_failed, 1, 0)
	_print_trace("setup-error", setup_failed)
	var start_failed = _new_run()
	_platform_main(start_failed, 0, 1)
	_print_trace("start-error", start_failed)

# 教学脚手架：创建一份可独立观察的运行状态，不对应引擎函数。
func _new_run():
	return {"trace": [], "setup": false, "start": false, "run": false, "finish": false, "exit": 0}

# C++ 对照：platform/osx/godot_main_osx.mm::main / OS_OSX::run
func _platform_main(state, setup_error, start_error):
	state["trace"].append("godot_main_osx.mm::main forwards argc/argv")
	state["exit"] = _main_setup(state, setup_error)
	if state["exit"] != 0:
		state["trace"].append("setup error returns to platform entry")
		return
	state["exit"] = _main_start(state, start_error)
	if state["exit"] != 0:
		state["trace"].append("start error returns before OS::run")
		return
	state["run"] = true
	state["trace"].append("OS::run invokes MainLoop initialize/iteration")
	state["finish"] = true
	state["trace"].append("platform loop exits and Main cleanup runs")

# C++ 对照：Main::setup
func _main_setup(state, error_code):
	state["trace"].append("Main::setup initializes core and ProjectSettings")
	if error_code != 0:
		return error_code
	state["setup"] = true
	return 0

# C++ 对照：Main::start
func _main_start(state, error_code):
	if not state["setup"] or error_code != 0:
		return 1 if error_code == 0 else error_code
	state["start"] = true
	state["trace"].append("Main::start selects MainLoop and project scene")
	return 0

# 教学脚手架：打印状态与事件账本，不对应引擎函数。
func _print_trace(label, state):
	print("[replay S01] ", label, " setup=", state["setup"], " start=", state["start"], " run=", state["run"], " exit=", state["exit"])
	for event in state["trace"]:
		print("[replay S01] ", event)
