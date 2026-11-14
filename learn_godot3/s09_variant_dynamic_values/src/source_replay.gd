# S09 Godot 3.6: Variant tags and convert/evaluate stay separate from Object::callv.
extends Reference

func run():
	var integer = _variant("INT", 7)
	var real = _variant("REAL", 2.5)
	var converted = _convert(integer, "REAL")
	var sum = _evaluate_add(converted, real)
	var object = {"position": Vector2(0, 0)}
	var call = _object_callv(object, "set_position", [Vector2(12, 24)])
	print("[replay S09] type tags=", integer["type"], ", ", real["type"])
	print("[replay S09] convert(INT→REAL) then ADD=", sum)
	print("[replay S09] Object::callv result=", call, " position=", object["position"])
	print("[replay S09] var2str-style output=", _variant_to_text(sum))

func _variant(type_name, value):
	return {"type": type_name, "value": value}

func _convert(value, target_type):
	if value["type"] == "INT" and target_type == "REAL":
		return _variant("REAL", float(value["value"]))
	return value

func _evaluate_add(left, right):
	if left["type"] == "REAL" or right["type"] == "REAL":
		return _variant("REAL", float(left["value"]) + float(right["value"]))
	return _variant("INT", int(left["value"]) + int(right["value"]))

func _object_callv(object, method, args):
	if method == "set_position" and args.size() == 1:
		object["position"] = args[0]
		return {"error": "OK", "value": null}
	return {"error": "invalid method/argument count", "value": null}

func _variant_to_text(value):
	return str(value["value"])
