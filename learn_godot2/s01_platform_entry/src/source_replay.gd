# S01 Godot 2.1: macOS entry forwards argv and preserves setup/start error gates.
extends Reference

# 教学复刻模型：转译本课 C++ 摘录中的选定数据结构、分支和状态更新。
# 不调用私有 C++；真实引擎行为由本课独立 GDScript probe 观察。

# 教学脚手架：按本课顺序组装输入、执行模型并打印观察结果。
func run():
	var success = _new_run()
	_platform_main(success, false, false)
	_print_trace("success", success)
	var setup_error = _new_run()
	_platform_main(setup_error, true, false)
	_print_trace("setup-error", setup_error)
	var start_error = _new_run()
	_platform_main(start_error, false, true)
	_print_trace("start-error", start_error)

# 教学脚手架：创建一份可独立观察的运行状态，不对应引擎函数。
func _new_run():
	return {"trace": [], "setup_done": false, "start_called": false, "os_run": false, "cleanup": false, "exit_code": 0}

# C++ 对照：platform/osx/godot_main_osx.mm::main / OS_OSX::run
func _platform_main(state, fail_setup, fail_start):
	state["trace"].append("godot_main_osx.mm::main passes argc/argv to Main::setup")
	var error_code = _main_setup(state, fail_setup)
	if error_code != 0:
		state["exit_code"] = error_code
		state["trace"].append("setup failed; no Main::start call")
		return
	error_code = _main_start(state, fail_start)
	if error_code != 0:
		state["exit_code"] = error_code
		state["trace"].append("start failed; no OS::run call")
		return
	state["os_run"] = true
	state["trace"].append("OS::run initializes and iterates MainLoop")
	state["cleanup"] = true
	state["trace"].append("Main::cleanup runs after OS::run")

# C++ 对照：Main::setup
func _main_setup(state, fail):
	state["trace"].append("Main::setup builds core and project settings")
	if fail:
		return 1
	state["setup_done"] = true
	return 0

# C++ 对照：Main::start
func _main_start(state, fail):
	if not state["setup_done"] or fail:
		return 1
	state["start_called"] = true
	state["trace"].append("Main::start selects SceneTree and main scene")
	return 0

# 教学脚手架：打印状态与事件账本，不对应引擎函数。
func _print_trace(label, state):
	print("[replay S01] ", label, " exit=", state["exit_code"], " start_called=", state["start_called"], " OS::run=", state["os_run"])
	for event in state["trace"]:
		print("[replay S01] ", event)
