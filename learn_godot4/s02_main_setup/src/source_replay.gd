# S02 Godot 4.7: setup separates engine main_args from args after -- or ++.
extends RefCounted

func run():
	var parsed = _parse_args(["godot", "--editor", "--", "--course-probe"])
	print("[replay S02] editor=", parsed["editor"], " main_args=", parsed["main_args"], " user_args=", parsed["user_args"])
	print("[replay S02] setup stages=", _setup(parsed, true))
	print("[replay S02] separator ++ also begins user args=", _parse_args(["godot", "++", "x"])["user_args"])
	print("[replay S02] --path is build-option gated in this snapshot; experiment uses current project path")

func _parse_args(argv):
	var state = {"editor": false, "main_args": [], "user_args": [], "user_mode": false, "error": 0}
	var i = 1
	while i < argv.size():
		var arg = argv[i]
		if arg == "--" or arg == "++":
			state["user_mode"] = true
			i += 1
		elif state["user_mode"]:
			state["user_args"].append(arg)
			i += 1
		elif arg == "--editor":
			state["editor"] = true
			i += 1
		elif arg == "--path":
			state["error"] = 2
			return state
		else:
			state["main_args"].append(arg)
			i += 1
	return state

func _setup(parsed, second_phase):
	var stages = ["initialize OS and core types", "scan args into main_args/user_args", "load project settings", "OS::set_cmdline(main_args, user_args)"]
	if parsed["error"] != 0:
		stages.append("OVERRIDE_PATH_ENABLED is disabled: reject --path")
	elif second_phase:
		stages.append("Main::setup2")
	return stages
