# 本课 C++ 调用路径的 GDScript 教学复刻，不是 Godot 引擎实现。
extends Reference

# Variant operator dispatch model: choose the numeric operation from operand type tags.
func run():
	var left = {"type": "INT", "value": 7}
	var right = {"type": "REAL", "value": 2.5}
	var result = _add(left, right)
	print("[replay S10] Variant::evaluate(ADD) → ", result["value"], " type=", result["type"])
	var text = _variant_to_string(result)
	print("[replay S10] stringify → ", text)

func _add(left, right):
	if left["type"] == "REAL" or right["type"] == "REAL":
		return {"type": "REAL", "value": float(left["value"]) + float(right["value"])}
	return {"type": "INT", "value": int(left["value"]) + int(right["value"])}

func _variant_to_string(value):
	return str(value["value"])
