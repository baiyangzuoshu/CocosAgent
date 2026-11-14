# S01 Godot 4.7: AppKit delegate → macOS entry → Main → OS_MacOS run loop.
extends RefCounted

# 教学复刻模型：转译本课 C++ 摘录中的选定数据结构、分支和状态更新。
# 不调用私有 C++；真实引擎行为由本课独立 GDScript probe 观察。

# 教学脚手架：按本课顺序组装输入、执行模型并打印观察结果。
func run():
	var ok = _new_run()
	_appkit_launch(ok, false, false)
	_print_trace("success", ok)
	var failed = _new_run()
	_appkit_launch(failed, true, false)
	_print_trace("setup-error", failed)
	var start_failed = _new_run()
	_appkit_launch(start_failed, false, true)
	_print_trace("start-error", start_failed)

# 教学脚手架：创建一份可独立观察的运行状态，不对应引擎函数。
func _new_run():
	return {"trace": [], "setup": false, "start": false, "os_run": false, "cleanup": false, "exit": 0}

# C++ 对照：OS_MacOS_NSApp::run / start_main
func _appkit_launch(state, fail_setup, fail_start):
	state["trace"].append("NSApplication delegate receives applicationDidFinishLaunching")
	state["trace"].append("godot_main_macos.mm creates OS_MacOS and forwards argv")
	state["exit"] = _main_setup(state, fail_setup)
	if state["exit"] != 0:
		state["trace"].append("setup error returns; Main::start is skipped")
		return
	state["exit"] = _main_start(state, fail_start)
	if state["exit"] != 0:
		state["trace"].append("Main::start failed; return before OS_MacOS::run")
		return
	state["os_run"] = true
	state["trace"].append("OS_MacOS::run owns the native event/update loop")
	state["cleanup"] = true
	state["trace"].append("Main::cleanup after run returns")

# C++ 对照：Main::setup
func _main_setup(state, fail_setup):
	state["trace"].append("Main::setup initializes core types and project settings")
	if fail_setup:
		return 1
	state["setup"] = true
	return 0

# C++ 对照：Main::start
func _main_start(state, fail_start):
	if not state["setup"] or fail_start:
		return 1
	state["start"] = true
	state["trace"].append("Main::start selects SceneTree and main scene")
	return 0

# 教学脚手架：打印状态与事件账本，不对应引擎函数。
func _print_trace(label, state):
	print("[replay S01] ", label, " start=", state["start"], " os_run=", state["os_run"], " exit=", state["exit"])
	for event in state["trace"]:
		print("[replay S01] ", event)
