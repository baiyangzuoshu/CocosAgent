# S02 Godot 3.6: --path/--upwards update project selection; leftovers become main_args.
extends Reference

func run():
	var parsed = _parse_args(["godot", "--path", "lesson-project", "--upwards", "--course-probe"])
	print("[replay S02] project=", parsed["project"], " search upwards=", parsed["upwards"])
	print("[replay S02] main_args=", parsed["main_args"])
	print("[replay S02] setup phases=", _setup(parsed, true))
	print("[replay S02] missing --path value=", _parse_args(["godot", "--path"])["error"])

func _parse_args(argv):
	var state = {"project": ".", "upwards": false, "editor": false, "main_args": [], "error": 0}
	var i = 1
	while i < argv.size():
		var arg = argv[i]
		if arg == "--path":
			if i + 1 >= argv.size():
				state["error"] = 1
				return state
			state["project"] = argv[i + 1]
			i += 2
		elif arg == "--upwards":
			state["upwards"] = true
			i += 1
		elif arg == "--editor":
			state["editor"] = true
			i += 1
		else:
			state["main_args"].append(arg)
			i += 1
	return state

func _setup(parsed, second_phase):
	var phases = ["register core objects", "ProjectSettings::setup(project)", "OS::set_cmdline(execpath, main_args)"]
	if parsed["error"] != 0:
		return ["abort on argument error"]
	if second_phase:
		phases.append("Main::setup2")
	return phases
