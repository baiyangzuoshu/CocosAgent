# S09 Godot 4.7: strict Variant construction, utility text round-trip, Object::callp.
extends RefCounted

func run():
	var float_ok = _construct("FLOAT", "2.5")
	var int_ok = _construct("INT", "42")
	var int_fail = _construct("INT", "4.2")
	var encoded = _var_to_str({"type": "INT", "value": int_ok["value"]})
	var restored = _str_to_var(encoded)
	var object = {"position": Vector2i(0, 0)}
	var call = _object_callp(object, "set_position", [Vector2i(12, 24)])
	print("[replay S09] FLOAT=", float_ok, " INT=", int_ok, " strict INT failure=", int_fail)
	print("[replay S09] var_to_str/str_to_var=", encoded, " → ", restored)
	print("[replay S09] separate Object::callp path=", call, " position=", object["position"])

func _construct(type_name, text):
	if type_name == "FLOAT":
		return {"ok": true, "type": "FLOAT", "value": float(text)}
	if type_name == "INT" and _is_integer(text):
		return {"ok": true, "type": "INT", "value": int(text)}
	return {"ok": false, "type": type_name, "value": null}

func _is_integer(text):
	var start = 1 if text.begins_with("-") or text.begins_with("+") else 0
	if start >= text.length():
		return false
	for i in range(start, text.length()):
		if "0123456789".find(text.substr(i, 1)) == -1:
			return false
	return true

func _var_to_str(value):
	return str(value["value"])

func _str_to_var(text):
	if _is_integer(text):
		return {"type": "INT", "value": int(text)}
	return {"type": "FLOAT", "value": float(text)}

func _object_callp(object, method, args):
	if method == "set_position" and args.size() == 1:
		object["position"] = args[0]
		return {"error": "OK", "return": null}
	return {"error": "invalid method/arguments", "return": null}
