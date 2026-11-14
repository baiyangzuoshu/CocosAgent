# 本课 C++ 调用路径的 GDScript 教学复刻，不是 Godot 引擎实现。
extends RefCounted

# Godot 4 represents a method target as Callable; Signal emits through its connection list.
func run():
	var callable = {"object_id": 1, "method": "on_score", "bound": []}
	var connections = [callable]
	for target in connections:
		_invoke(target, [7])
	print("[replay S10] Callable.call result: ", _invoke({"method": "double_score", "bound": []}, [7]))
	print("[replay S10] Callable.bind(5) result: ", _invoke({"method": "add", "bound": [5]}, [2]))

func _invoke(target, args):
	var values = args + target["bound"]
	if target["method"] == "on_score":
		print("[replay S10] emit_signalp → Callable.callp on_score(", values[0], ")")
		return null
	if target["method"] == "double_score":
		return values[0] * 2
	if target["method"] == "add":
		return values[0] + values[1]
	return null
