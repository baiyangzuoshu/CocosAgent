# S10 Godot 2.1: GDScript operator bytecode selects a Variant operation implementation.
extends Reference

func run():
	var integer = {"type": "INT", "value": 7}
	var real = {"type": "REAL", "value": 2.5}
	var sum = _evaluate("ADD", integer, real)
	var converted = _construct("STRING", sum)
	var zero = _evaluate("DIV", integer, {"type": "INT", "value": 0})
	print("[replay S10] OP_ADD result/tag=", sum)
	print("[replay S10] construct string=", converted)
	print("[replay S10] OP_DIV error path=", zero)

func _evaluate(op, left, right):
	if op == "ADD" and (left["type"] == "STRING" or right["type"] == "STRING"):
		return {"ok": true, "type": "STRING", "value": str(left["value"]) + str(right["value"])}
	if op == "ADD" and (left["type"] == "REAL" or right["type"] == "REAL"):
		return {"ok": true, "type": "REAL", "value": float(left["value"]) + float(right["value"])}
	if op == "ADD":
		return {"ok": true, "type": "INT", "value": int(left["value"]) + int(right["value"])}
	if op == "DIV" and float(right["value"]) != 0.0:
		return {"ok": true, "type": "REAL", "value": float(left["value"]) / float(right["value"])}
	return {"ok": false, "type": "NIL", "value": null}

func _construct(type_name, source):
	if not source["ok"]:
		return {"ok": false, "type": type_name, "value": null}
	return {"ok": true, "type": type_name, "value": str(source["value"])}
