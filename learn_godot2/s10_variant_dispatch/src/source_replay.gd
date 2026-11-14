# Executable teaching model of selected C++ logic; not the Godot engine implementation.
extends Reference

# GDScript operation → Variant::evaluate/construct → textual conversion.
func run():
	var left = _variant("INT", 7)
	var right = _variant("REAL", 2.5)
	var sum = _evaluate("ADD", left, right)
	var text_value = _construct("STRING", sum)
	print("[replay S10] Variant::evaluate ADD=", sum)
	print("[replay S10] Variant::construct STRING=", text_value)
	print("[replay S10] var2str-style text=", _variant_to_string(sum))
	print("[replay S10] divide by zero=", _evaluate("DIV", left, _variant("INT", 0)))

func _variant(type_name, value):
	return {"type": type_name, "value": value}

func _evaluate(operator, left, right):
	if operator == "ADD":
		if left["type"] == "STRING" or right["type"] == "STRING":
			return _variant("STRING", str(left["value"]) + str(right["value"]))
		if left["type"] == "REAL" or right["type"] == "REAL":
			return _variant("REAL", float(left["value"]) + float(right["value"]))
		return _variant("INT", int(left["value"]) + int(right["value"]))
	if operator == "DIV" and float(right["value"]) != 0.0:
		return _variant("REAL", float(left["value"]) / float(right["value"]))
	return {"error": "invalid operation", "type": "NIL", "value": null}

func _construct(type_name, value):
	if type_name == "STRING":
		return _variant("STRING", str(value["value"]))
	return {"error": "unsupported constructor", "type": type_name, "value": null}

func _variant_to_string(value):
	return str(value["value"])
