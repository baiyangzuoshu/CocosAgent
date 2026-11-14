# S10 Godot 2.1: GDScript operator bytecode selects a Variant operation implementation.
extends Reference

# 教学复刻模型：转译本课 C++ 摘录中的选定数据结构、分支和状态更新。
# 不调用私有 C++；真实引擎行为由本课独立 GDScript probe 观察。

# 教学脚手架：按本课顺序组装输入、执行模型并打印观察结果。
func run():
	var integer = {"type": "INT", "value": 7}
	var real = {"type": "REAL", "value": 2.5}
	var sum = _evaluate("ADD", integer, real)
	var converted = _construct("STRING", sum)
	var zero = _evaluate("DIV", integer, {"type": "INT", "value": 0})
	print("[replay S10] OP_ADD result/tag=", sum)
	print("[replay S10] construct string=", converted)
	print("[replay S10] OP_DIV error path=", zero)

# C++ 对照：GDScript operator opcode → Variant::evaluate
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

# C++ 对照：Variant::construct / Variant::can_convert
func _construct(type_name, source):
	if not source["ok"]:
		return {"ok": false, "type": type_name, "value": null}
	return {"ok": true, "type": type_name, "value": str(source["value"])}
