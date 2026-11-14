# 本课 C++ 调用路径的 GDScript 教学复刻，不是 Godot 引擎实现。
extends Reference

# Dynamic Variant model: runtime type tag, conversion, then operator dispatch.
func run():
	var left = {"type": "INT", "value": 7}
	var right = {"type": "REAL", "value": 2.5}
	var converted = _convert_to_real(left)
	var result = _evaluate_add(converted, right)
	print("[replay S09] Variant tags: ", left["type"], " + ", right["type"])
	print("[replay S09] converted result: ", result["value"], " type=", result["type"])
	print("[replay S09] Object::callv carries Variant arguments into the bound method")

func _convert_to_real(value):
	return {"type": "REAL", "value": float(value["value"])}

func _evaluate_add(left, right):
	return {"type": "REAL", "value": left["value"] + right["value"]}
