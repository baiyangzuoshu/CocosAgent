# S01 Godot 3.6: macOS native entry → Main setup/start → OS run.
extends Reference

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

func _new_run():
	return {"trace": [], "setup": false, "start": false, "run": false, "finish": false, "exit": 0}

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

func _main_setup(state, error_code):
	state["trace"].append("Main::setup initializes core and ProjectSettings")
	if error_code != 0:
		return error_code
	state["setup"] = true
	return 0

func _main_start(state, error_code):
	if not state["setup"] or error_code != 0:
		return 1 if error_code == 0 else error_code
	state["start"] = true
	state["trace"].append("Main::start selects MainLoop and project scene")
	return 0

func _print_trace(label, state):
	print("[replay S01] ", label, " setup=", state["setup"], " start=", state["start"], " run=", state["run"], " exit=", state["exit"])
	for event in state["trace"]:
		print("[replay S01] ", event)
