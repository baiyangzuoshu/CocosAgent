# S09 Godot 1.1: registered MethodBind routes set_pos/get_pos and transform/pos.
extends Reference

# 教学复刻模型：转译本课 C++ 摘录中的选定数据结构、分支和状态更新。
# 不调用私有 C++；真实引擎行为由本课独立 GDScript probe 观察。

# 教学脚手架：按本课顺序组装输入、执行模型并打印观察结果。
func run():
	var registry = {"set_pos": {"argc": 1, "body": "set_pos"}, "get_pos": {"argc": 0, "body": "get_pos"}}
	var properties = {"transform/pos": {"setter": "set_pos", "getter": "get_pos"}}
	var node = {"pos": Vector2(0, 0)}
	_bind_property(properties, "transform/pos", "set_pos", "get_pos")
	var write = _callv(node, registry, "set_pos", [Vector2(12, 24)])
	var through_property = _get(node, properties, registry, "transform/pos")
	_set(node, properties, registry, "transform/pos", Vector2(30, 40))
	var final_pos = _callv(node, registry, "get_pos", [])
	print("[replay S09] callv result=", write, " first property read=", through_property["value"])
	print("[replay S09] property setter then MethodBind getter=", final_pos["value"])
	print("[replay S09] missing argument=", _callv(node, registry, "set_pos", []))

# C++ 对照：Node2D::_bind_methods / ADD_PROPERTY
func _bind_property(properties, path, setter, getter):
	properties[path] = {"setter": setter, "getter": getter}

# C++ 对照：Object::callv → Object::call → MethodBind::call
func _callv(node, registry, method, args):
	if not registry.has(method):
		return {"error": "invalid method", "value": null}
	var bind = registry[method]
	if args.size() != bind["argc"]:
		return {"error": "too few/many arguments", "value": null}
	if bind["body"] == "set_pos":
		node["pos"] = args[0]
		return {"error": "OK", "value": null}
	if bind["body"] == "get_pos":
		return {"error": "OK", "value": node["pos"]}
	return {"error": "unimplemented", "value": null}

# C++ 对照：Object::get → ObjectTypeDB::get_property
func _get(node, properties, registry, path):
	if not properties.has(path):
		return {"error": "property not found", "value": null}
	return _callv(node, registry, properties[path]["getter"], [])

# C++ 对照：Object::set → ObjectTypeDB::set_property
func _set(node, properties, registry, path, value):
	if not properties.has(path):
		return false
	return _callv(node, registry, properties[path]["setter"], [value])["error"] == "OK"
