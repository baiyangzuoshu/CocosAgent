# Executable teaching model of selected C++ logic; not the Godot engine implementation.
extends RefCounted

# C++ focus: platform/macos/godot_application_delegate.mm → godot_main_macos.mm → Main::setup() → Main::start() → OS::run().
func run():
	var success = _new_state()
	var result = _platform_entry(success, false)
	print("[replay S01] success return=", result)
	for event in success["trace"]:
		print("[replay S01] ", event)
	var failure = _new_state()
	result = _platform_entry(failure, true)
	print("[replay S01] setup failure return=", result, " start_called=", failure["start_called"])

func _new_state():
	return {"trace": [], "setup_ok": false, "start_called": false, "loop_initialized": false, "ready_called": false, "cleaned": false}

func _platform_entry(state, force_setup_error):
	_trace(state, "platform/macos/godot_application_delegate.mm → godot_main_macos.mm creates OS and forwards command-line arguments")
	var error_code = _main_setup(state, force_setup_error)
	if error_code != 0:
		_trace(state, "setup Error returned; Main::start is skipped")
		return error_code
	error_code = _main_start(state)
	if error_code != 0:
		_trace(state, "start Error returned; OS::run is skipped")
		return error_code
	_os_run(state)
	_main_cleanup(state)
	return 0

func _main_setup(state, fail):
	_trace(state, "Main::setup initializes core and project state")
	if fail:
		return 1
	state["setup_ok"] = true
	return 0

func _main_start(state):
	if not state["setup_ok"]:
		return 1
	state["start_called"] = true
	_trace(state, "Main::start installs configured scene and MainLoop")
	return 0

func _os_run(state):
	_trace(state, "OS::run calls MainLoop initialization")
	_main_loop_initialize(state)
	_trace(state, "OS::run advances MainLoop once")
	state["trace"].append("iteration returns quit=true")

func _main_loop_initialize(state):
	state["loop_initialized"] = true
	state["ready_called"] = true
	_trace(state, "SceneTree root enters tree; READY is delivered to nodes")

func _main_cleanup(state):
	state["cleaned"] = true
	_trace(state, "platform loop returns; Main::cleanup runs")

func _trace(state, value):
	state["trace"].append(value)
