# S01 Godot 1.1: macOS entry → Main::setup/start → OS::run.
extends Reference

# 教学复刻模型：转译本课 C++ 摘录中的选定数据结构、分支和状态更新。
# 不调用私有 C++；真实引擎行为由本课独立 GDScript probe 观察。

# 教学脚手架：按本课顺序组装输入、执行模型并打印观察结果。
func run():
	var ok = _new_run()
	_platform_main(ok, false, false)
	_print_trace("success", ok)
	var failed = _new_run()
	_platform_main(failed, true, false)
	_print_trace("setup-error", failed)
	var start_failed = _new_run()
	_platform_main(start_failed, false, true)
	_print_trace("start-error", start_failed)

# 教学脚手架：创建一份可独立观察的运行状态，不对应引擎函数。
func _new_run():
	return {"trace": [], "setup_done": false, "start_called": false, "loop_installed": false, "cleaned": false, "exit_code": 0}

# C++ 对照：platform/osx/godot_main_osx.mm::main / OS_OSX::run
func _platform_main(state, fail_setup, fail_start):
	state["trace"].append("godot_main_osx.mm::main forwards argc/argv")
	var error_code = _main_setup(state, fail_setup)
	if error_code != 0:
		state["exit_code"] = error_code
		state["trace"].append("return setup error; skip Main::start")
		return
	error_code = _main_start(state, fail_start)
	if error_code != 0:
		state["exit_code"] = error_code
		state["trace"].append("return start error; skip OS::run")
		return
	state["loop_installed"] = true
	state["trace"].append("OS::run enters MainLoop")
	state["trace"].append("MainLoop::iteration returns quit=true")
	state["cleaned"] = true
	state["trace"].append("Main::cleanup after OS::run")

# C++ 对照：Main::setup
func _main_setup(state, fail_setup):
	state["trace"].append("Main::setup initializes core and project settings")
	if fail_setup:
		return 1
	state["setup_done"] = true
	return 0

# C++ 对照：Main::start
func _main_start(state, fail_start):
	if not state["setup_done"] or fail_start:
		return 1
	state["start_called"] = true
	state["trace"].append("Main::start installs SceneTree and configured main scene")
	return 0

# 教学脚手架：打印状态与事件账本，不对应引擎函数。
func _print_trace(label, state):
	print("[replay S01] ", label, " exit=", state["exit_code"], " start_called=", state["start_called"])
	for event in state["trace"]:
		print("[replay S01] ", event)
