# S10 Godot 1.1: GDScript opcode selects Variant::evaluate, then construct/serialization.
extends Reference

# 教学复刻模型：转译本课 C++ 摘录中的选定数据结构、分支和状态更新。
# 不调用私有 C++；真实引擎行为由本课独立 GDScript probe 观察。

# 教学脚手架：按本课顺序组装输入、执行模型并打印观察结果。
func run():
	var left = {"type": "INT", "value": 7}
	var right = {"type": "REAL", "value": 2.5}
	var add = _evaluate(0, left, right)
	var as_string = _construct_string(add)
	var division_by_zero = _evaluate(1, left, {"type": "INT", "value": 0})
	print("[replay S10] OP_ADD dispatch result=", add)
	print("[replay S10] Variant::construct STRING=", as_string)
	print("[replay S10] OP_DIV zero error=", division_by_zero)

# C++ 对照：GDScript operator opcode → Variant::evaluate
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

# C++ 对照：Variant::construct / Variant::can_convert
func _construct_string(value):
	if value["error"] != "OK":
		return {"error": value["error"], "value": null}
	return {"error": "OK", "type": "STRING", "value": str(value["value"])}
