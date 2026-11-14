# S01 Godot 2.1: macOS entry forwards argv and preserves setup/start error gates.
extends Reference

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

func _new_run():
	return {"trace": [], "setup_done": false, "start_called": false, "os_run": false, "cleanup": false, "exit_code": 0}

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

func _main_setup(state, fail):
	state["trace"].append("Main::setup builds core and project settings")
	if fail:
		return 1
	state["setup_done"] = true
	return 0

func _main_start(state, fail):
	if not state["setup_done"] or fail:
		return 1
	state["start_called"] = true
	state["trace"].append("Main::start selects SceneTree and main scene")
	return 0

func _print_trace(label, state):
	print("[replay S01] ", label, " exit=", state["exit_code"], " start_called=", state["start_called"], " OS::run=", state["os_run"])
	for event in state["trace"]:
		print("[replay S01] ", event)
