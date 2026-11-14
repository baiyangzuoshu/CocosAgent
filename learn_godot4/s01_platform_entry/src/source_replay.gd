# S01 Godot 4.7: AppKit delegate → macOS entry → Main → OS_MacOS run loop.
extends RefCounted

func run():
	var ok = _new_run()
	_appkit_launch(ok, false)
	_print_trace("success", ok)
	var failed = _new_run()
	_appkit_launch(failed, true)
	_print_trace("setup-error", failed)

func _new_run():
	return {"trace": [], "setup": false, "start": false, "os_run": false, "cleanup": false, "exit": 0}

func _appkit_launch(state, fail_setup):
	state["trace"].append("NSApplication delegate receives applicationDidFinishLaunching")
	state["trace"].append("godot_main_macos.mm creates OS_MacOS and forwards argv")
	state["exit"] = _main_setup(state, fail_setup)
	if state["exit"] != 0:
		state["trace"].append("setup error returns; Main::start is skipped")
		return
	state["exit"] = _main_start(state)
	if state["exit"] != 0:
		return
	state["os_run"] = true
	state["trace"].append("OS_MacOS::run owns the native event/update loop")
	state["cleanup"] = true
	state["trace"].append("Main::cleanup after run returns")

func _main_setup(state, fail_setup):
	state["trace"].append("Main::setup initializes core types and project settings")
	if fail_setup:
		return 1
	state["setup"] = true
	return 0

func _main_start(state):
	if not state["setup"]:
		return 1
	state["start"] = true
	state["trace"].append("Main::start selects SceneTree and main scene")
	return 0

func _print_trace(label, state):
	print("[replay S01] ", label, " start=", state["start"], " os_run=", state["os_run"], " exit=", state["exit"])
	for event in state["trace"]:
		print("[replay S01] ", event)
