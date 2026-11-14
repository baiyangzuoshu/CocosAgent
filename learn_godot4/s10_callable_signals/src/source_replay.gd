# S10 Godot 4.7: SignalData stores Callable; emit snapshots slots before callp.
extends RefCounted

# 教学复刻模型：转译本课 C++ 摘录中的选定数据结构、分支和状态更新。
# 不调用私有 C++；真实引擎行为由本课独立 GDScript probe 观察。

# 教学脚手架：按本课顺序组装输入、执行模型并打印观察结果。
func run():
	var objects = {41: {"score": 0}}
	var slots = []
	var on_score = _make_callable(41, "on_score", [])
	var first = _connect(slots, "score_changed", on_score)
	var duplicate = _connect(slots, "score_changed", on_score)
	var same_base_with_bind = _connect(slots, "score_changed", _make_callable(41, "on_score", [999]))
	_emit(objects, slots, "score_changed", [7])
	var add_five = _make_callable(41, "add", [5])
	var bound_result = _callp(objects, add_five, [2])
	print("[replay S10] connected=", first, " duplicate rejected=", not duplicate, " bind ignored for duplicate identity=", not same_base_with_bind)
	print("[replay S10] signal result score=", objects[41]["score"])
	print("[replay S10] Callable::callp args + bound args=", bound_result)

# C++ 对照：Callable::Callable / Callable::bind
func _make_callable(object_id, method, bound_args):
	return {"object_id": object_id, "method": method, "bound_args": bound_args}

# C++ 对照：Object::connect / SignalData connection list
func _connect(slots, signal_name, callable):
	for slot in slots:
		if slot["signal"] == signal_name and _same_callable(slot["callable"], callable):
			return false
	slots.append({"signal": signal_name, "callable": callable})
	return true

# C++ 对照：Callable identity/equality fields
func _same_callable(left, right):
	# Object::connect compares get_base_comparator(); CallableBind removes bound args from this key.
	return left["object_id"] == right["object_id"] and left["method"] == right["method"]

# C++ 对照：Object::emit_signalp / connection snapshot
func _emit(objects, slots, signal_name, emitted_args):
	var snapshot = slots.duplicate()
	for slot in snapshot:
		if slot["signal"] == signal_name:
			_callp(objects, slot["callable"], emitted_args)

# C++ 对照：Callable::callp → Object::callp
func _callp(objects, callable, args):
	if not objects.has(callable["object_id"]):
		return null
	var all_args = args + callable["bound_args"]
	if callable["method"] == "on_score":
		objects[callable["object_id"]]["score"] = all_args[0]
		return null
	if callable["method"] == "add":
		return all_args[0] + all_args[1]
	return null
