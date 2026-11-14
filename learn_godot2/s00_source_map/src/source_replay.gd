# S00 Godot 2.1: generated version fields flow through OS into GDScript.
extends Reference

func run():
	var fields = {"major": 2, "minor": 1, "patch": 7, "status": "rc"}
	var macros = _generated_version_macros(fields)
	var os_dictionary = _os_engine_version(macros)
	print("[replay S00] version.py fields=", fields)
	print("[replay S00] generated macros=", macros)
	print("[replay S00] OS.get_engine_version()=", os_dictionary)
	print("[replay S00] main source areas=", ["main/", "core/", "modules/gdscript/", "scene/", "servers/ + drivers/"])

func _generated_version_macros(fields):
	return {"VERSION_MAJOR": fields["major"], "VERSION_MINOR": fields["minor"], "VERSION_PATCH": fields["patch"], "VERSION_STATUS": fields["status"]}

func _os_engine_version(macros):
	return {"major": str(macros["VERSION_MAJOR"]), "minor": str(macros["VERSION_MINOR"]), "patch": str(macros["VERSION_PATCH"]), "status": macros["VERSION_STATUS"]}
