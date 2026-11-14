# S01 Godot 1.1: macOS entry → Main::setup/start → OS::run.
extends Reference

func run():
	var ok = _new_run()
	_platform_main(ok, false)
	_print_trace("success", ok)
	var failed = _new_run()
	_platform_main(failed, true)
	_print_trace("setup-error", failed)

func _new_run():
	return {"trace": [], "setup_done": false, "start_called": false, "loop_installed": false, "cleaned": false, "exit_code": 0}

func _platform_main(state, fail_setup):
	state["trace"].append("godot_main_osx.mm::main forwards argc/argv")
	var error_code = _main_setup(state, fail_setup)
	if error_code != 0:
		state["exit_code"] = error_code
		state["trace"].append("return setup error; skip Main::start")
		return
	error_code = _main_start(state)
	if error_code != 0:
		state["exit_code"] = error_code
		state["trace"].append("return start error; skip OS::run")
		return
	state["loop_installed"] = true
	state["trace"].append("OS::run enters MainLoop")
	state["trace"].append("MainLoop::iteration returns quit=true")
	state["cleaned"] = true
	state["trace"].append("Main::cleanup after OS::run")

func _main_setup(state, fail_setup):
	state["trace"].append("Main::setup initializes core and project settings")
	if fail_setup:
		return 1
	state["setup_done"] = true
	return 0

func _main_start(state):
	if not state["setup_done"]:
		return 1
	state["start_called"] = true
	state["trace"].append("Main::start installs SceneTree and configured main scene")
	return 0

func _print_trace(label, state):
	print("[replay S01] ", label, " exit=", state["exit_code"], " start_called=", state["start_called"])
	for event in state["trace"]:
		print("[replay S01] ", event)
