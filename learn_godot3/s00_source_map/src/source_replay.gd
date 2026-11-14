# S00 Godot 3.6: build version macros are exposed through Engine.get_version_info().
extends Reference

func run():
	var source = {"major": 3, "minor": 6, "patch": 4, "status": "rc", "year": 2026}
	var macros = _build_macros(source)
	var engine_info = _engine_version_info(macros)
	print("[replay S00] version.py=", source)
	print("[replay S00] generated fields=", macros)
	print("[replay S00] Engine.get_version_info() model=", engine_info)
	print("[replay S00] core paths=", ["main/", "core/", "modules/gdscript/", "scene/", "servers/", "drivers/"])

func _build_macros(source):
	return {"VERSION_MAJOR": source["major"], "VERSION_MINOR": source["minor"], "VERSION_PATCH": source["patch"], "VERSION_STATUS": source["status"], "VERSION_YEAR": source["year"]}

func _engine_version_info(macros):
	return {"major": macros["VERSION_MAJOR"], "minor": macros["VERSION_MINOR"], "patch": macros["VERSION_PATCH"], "status": macros["VERSION_STATUS"], "year": macros["VERSION_YEAR"]}
