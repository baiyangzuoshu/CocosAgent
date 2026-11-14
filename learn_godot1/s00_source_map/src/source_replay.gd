# S00 Godot 1.1: version.py → generated build macros → old script surface.
extends Reference

func run():
	var fields = _snapshot_fields()
	var macros = _generated_version_macros(fields)
	print("[replay S00] source fields=", fields)
	print("[replay S00] generated version macros=", macros)
	print("[replay S00] script query=", _script_version_query())
	print("[replay S00] source areas=", _source_areas())

func _snapshot_fields():
	return {"major": 1, "minor": 1, "status": "stable"}

func _generated_version_macros(fields):
	return {"VERSION_MAJOR": fields["major"], "VERSION_MINOR": fields["minor"], "VERSION_STATUS": fields["status"]}

func _script_version_query():
	return "Godot 1.1 does not bind Engine.get_version_info or OS.get_engine_version; use the executable/editor label."

func _source_areas():
	return ["main/: entry and Main::iteration", "core/: Object, Variant and OS", "scene/: SceneTree and Node", "servers/ + drivers/: server interface and backend", "platform/: native startup"]
