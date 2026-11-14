# Executable teaching model of selected C++ logic; not the Godot engine implementation.
extends Reference

# C++ focus: version.py → build script → version macros → OS/Engine script binding.
func run():
	var fields = _version_fields()
	print("[replay S00] version.py inputs=", fields)
	print("[replay S00] generated VERSION_FULL_NAME=", _compiled_full_name(fields))
	print("[replay S00] script bridge=", _script_version_bridge())
	print("[replay S00] runtime version string=", _runtime_version_string(fields))
	_print_source_map()

func _version_fields():
	return {"major": 3, "minor": 6, "patch": 4, "patch_defined": true, "status": "rc", "build": "custom_build"}

func _compiled_full_name(fields):
	var number = str(fields["major"]) + "." + str(fields["minor"])
	if fields["patch_defined"]:
		number += "." + str(fields["patch"])
	return "Godot Engine v" + number + "." + fields["status"] + "." + fields["build"]

func _script_version_bridge():
	return "Engine.get_version_info()"

func _runtime_version_string(fields):
	if fields["major"] == 1:
		return "not exposed in this GDScript API; inspect the executable/project manager"
	var number = str(fields["major"]) + "." + str(fields["minor"])
	if fields["patch_defined"]:
		number += "." + str(fields["patch"])
	return number + "-" + fields["status"] + " (" + fields["build"] + ")"

func _print_source_map():
	var areas = ["main/: entry and frame loop", "core/: Object, Variant, OS and resources", "modules/gdscript/: parse and execution", "scene/: Node, SceneTree and resources", "servers/ + drivers/: interfaces and backends", "platform/: native window and input"]
	for area in areas:
		print("[replay S00] ", area)
