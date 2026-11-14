# Executable teaching model of selected C++ logic; not the Godot engine implementation.
extends Reference

# Variant tags/conversion/evaluation; Object::callv receives a Variant argument array.
func run():
	var integer_value = _variant("INT", 7)
	var real_value = _variant("REAL", 2.5)
	var converted = _convert(integer_value, "REAL")
	var sum = _evaluate_add(converted, real_value)
	var object = {"position": Vector2(0, 0)}
	var call_result = _object_callv(object, "set_position", [Vector2(12, 24)])
	print("[replay S09] runtime tags=", integer_value["type"], " + ", real_value["type"])
	print("[replay S09] conversion then ADD=", sum)
	print("[replay S09] Object::callv=", call_result, " position=", object["position"])
	print("[replay S09] var2str-style output=", _variant_to_text(sum))

func _variant(type_name, value):
	return {"type": type_name, "value": value}

func _convert(value, target):
	if value["type"] == "INT" and target == "REAL":
		return _variant("REAL", float(value["value"]))
	return value

func _evaluate_add(left, right):
	if left["type"] == "REAL" or right["type"] == "REAL":
		return _variant("REAL", float(left["value"]) + float(right["value"]))
	return _variant("INT", int(left["value"]) + int(right["value"]))

func _object_callv(object, method, args):
	if method == "set_position" and args.size() == 1:
		object["position"] = args[0]
		return {"error": "", "value": null}
	return {"error": "invalid method or argument count", "value": null}

func _variant_to_text(value):
	return str(value["value"])
