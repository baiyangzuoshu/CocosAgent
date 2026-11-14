# Executable teaching model of selected C++ logic; not the Godot engine implementation.
extends RefCounted

# Variant::construct/utilities; Object::callp remains a separate object dispatch.
func run():
	var converted = _construct("FLOAT", "2.5")
	var failed = _construct("INT", "not-an-integer")
	var value = {"type": "FLOAT", "value": converted["value"]}
	var text = _variant_to_text(value)
	var restored = _text_to_variant(text)
	var object = {"position": Vector2(0, 0)}
	var call_result = _object_callp(object, "set_position", [Vector2(12, 24)])
	print("[replay S09] construct FLOAT=", converted, " failed INT=", failed)
	print("[replay S09] var_to_str/str_to_var=", restored)
	print("[replay S09] Object::callp=", call_result, " position=", object["position"])

func _construct(type_name, text):
	if type_name == "FLOAT":
		return {"ok": true, "type": type_name, "value": float(text)}
	if type_name == "INT" and _is_integer(str(text)):
		return {"ok": true, "type": type_name, "value": int(text)}
	return {"ok": false, "type": type_name, "value": null}

func _is_integer(text):
	var start = 0
	if text.begins_with("-") or text.begins_with("+"):
		start = 1
	if start >= text.length():
		return false
	for i in range(start, text.length()):
		if "0123456789".find(text.substr(i, 1)) == -1:
			return false
	return true

func _variant_to_text(value):
	if value["type"] == "STRING":
		return "\"" + str(value["value"]) + "\""
	return str(value["value"])

func _text_to_variant(text):
	var clean = str(text).strip_edges()
	if clean.begins_with("\"") and clean.ends_with("\""):
		return {"type": "STRING", "value": clean.substr(1, clean.length() - 2)}
	if _is_integer(clean):
		return {"type": "INT", "value": int(clean)}
	return {"type": "FLOAT", "value": float(clean)}

func _object_callp(object, method, args):
	if method == "set_position" and args.size() == 1:
		object["position"] = args[0]
		return {"error": "", "value": null}
	return {"error": "invalid method or argument count", "value": null}
