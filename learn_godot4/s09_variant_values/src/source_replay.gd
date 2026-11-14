# 本课 C++ 调用路径的 GDScript 教学复刻，不是 Godot 引擎实现。
extends RefCounted

# Variant value model: values carry a runtime type and built-in operators dispatch by type.
func run():
	var left = {"type": "INT", "value": 7}
	var right = {"type": "FLOAT", "value": 2.5}
	var result = _evaluate_add(left, right)
	print("[replay S09] Variant::evaluate(ADD, INT, FLOAT) → ", result["value"])
	print("[replay S09] result type: ", result["type"])
	print("[replay S09] Variant values are not Object instances; Object::callp is a separate dispatch path")

func _evaluate_add(left, right):
	if left["type"] == "FLOAT" or right["type"] == "FLOAT":
		return {"type": "FLOAT", "value": float(left["value"]) + float(right["value"])}
	return {"type": "INT", "value": int(left["value"]) + int(right["value"])}
