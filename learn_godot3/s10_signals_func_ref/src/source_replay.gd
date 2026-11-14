# 本课 C++ 调用路径的 GDScript 教学复刻，不是 Godot 引擎实现。
extends Reference

# Signal-to-method and FuncRef both eventually dispatch a named method on an Object.
func run():
	var connections = [{"target": "Receiver", "method": "on_score", "binds": []}]
	var emitted = 7
	for connection in connections:
		_invoke(connection["target"], connection["method"], [emitted])
	var function_ref = {"object_id": 1, "function": "double_score"}
	print("[replay S10] FuncRef holds ObjectID+method: ", function_ref)
	print("[replay S10] call_func result: ", _invoke("Receiver", function_ref["function"], [7]))

func _invoke(target, method, args):
	if method == "on_score":
		print("[replay S10] Object::call ", target, ".on_score(", args[0], ")")
		return null
	if method == "double_score":
		return args[0] * 2
	return null
