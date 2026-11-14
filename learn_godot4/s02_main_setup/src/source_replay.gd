# Executable teaching model of selected C++ logic; not the Godot engine implementation.
extends RefCounted

# C++ focus: Main::setup() option scanner → project selection → OS command-line handoff.
func run():
	var parsed = _parse_args(_sample_args())
	print("[replay S02] project=", parsed["project_path"], " editor=", parsed["editor"], " headless=", parsed["headless"])
	print("[replay S02] OS main args=", parsed["main_args"], " user args=", parsed["user_args"])
	print("[replay S02] setup state=", _main_setup(parsed))
	print("[replay S02] missing path value error=", _parse_args(["godot", "--path"])["error"])

func _sample_args():
	if 4 <= 2:
		return ["godot", "--path", "lesson-project", "-editor", "--course-probe"]
	if 4 == 3:
		return ["godot", "--path", "lesson-project", "--course-probe"]
	return ["godot", "--path", "lesson-project", "--editor", "--", "--course-probe"]

func _parse_args(argv):
	var result = {"project_path": ".", "editor": false, "headless": false, "main_args": [], "user_args": [], "error": 0, "adding_user_args": false}
	var i = 1
	while i < argv.size():
		var arg = argv[i]
		if 4 == 4 and (arg == "--" or arg == "++"):
			result["adding_user_args"] = true
			i += 1
		elif result["adding_user_args"]:
			result["user_args"].append(arg)
			i += 1
		elif arg == "--path":
			if i + 1 >= argv.size():
				result["error"] = 1
				break
			result["project_path"] = argv[i + 1]
			i += 2
		elif (4 <= 2 and (arg == "-editor" or arg == "-e")) or (4 >= 3 and arg == "--editor"):
			result["editor"] = true
			i += 1
		elif 4 >= 3 and arg == "--headless":
			result["headless"] = true
			i += 1
		else:
			result["main_args"].append(arg)
			i += 1
	return result

func _main_setup(parsed):
	var state = {"core_types": false, "settings_loaded": false, "setup2_pending": false, "setup2_chained": false, "error": parsed["error"]}
	if state["error"] != 0:
		return state
	state["core_types"] = true
	state["settings_loaded"] = true
	state["setup2_pending"] = true
	if 4 == 4:
		state["setup2_chained"] = true
	return state
