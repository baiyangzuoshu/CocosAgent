# S10 Godot 1.1: GDScript opcode selects Variant::evaluate, then construct/serialization.
extends Reference

func run():
	var left = {"type": "INT", "value": 7}
	var right = {"type": "REAL", "value": 2.5}
	var add = _evaluate(0, left, right)
	var as_string = _construct_string(add)
	var division_by_zero = _evaluate(1, left, {"type": "INT", "value": 0})
	print("[replay S10] OP_ADD dispatch result=", add)
	print("[replay S10] Variant::construct STRING=", as_string)
	print("[replay S10] OP_DIV zero error=", division_by_zero)

func _evaluate(op, left, right):
	if op == 0:
		if left["type"] == "REAL" or right["type"] == "REAL":
			return {"error": "OK", "type": "REAL", "value": float(left["value"]) + float(right["value"])}
		return {"error": "OK", "type": "INT", "value": int(left["value"]) + int(right["value"])}
	if op == 1:
		if float(right["value"]) == 0.0:
			return {"error": "division by zero", "type": "NIL", "value": null}
		return {"error": "OK", "type": "REAL", "value": float(left["value"]) / float(right["value"])}
	return {"error": "unsupported operator", "type": "NIL", "value": null}

func _construct_string(value):
	if value["error"] != "OK":
		return {"error": value["error"], "value": null}
	return {"error": "OK", "type": "STRING", "value": str(value["value"])}
