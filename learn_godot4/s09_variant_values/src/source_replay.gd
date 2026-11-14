# S09 Godot 4.7: strict Variant construction, utility text round-trip, Object::callp.
extends RefCounted

# 教学复刻模型：转译本课 C++ 摘录中的选定数据结构、分支和状态更新。
# 不调用私有 C++；真实引擎行为由本课独立 GDScript probe 观察。

# 教学脚手架：按本课顺序组装输入、执行模型并打印观察结果。
func run():
	var float_from_int = _construct("FLOAT", "INT", 2)
	var int_from_float = _construct("INT", "FLOAT", 4.2)
	var strict_int_from_string = _construct("INT", "STRING", "42")
	var utility_int_from_string = _type_convert("42", "INT")
	var encoded = _var_to_str(utility_int_from_string)
	var restored = _str_to_var(encoded)
	var object = {"position": Vector2i(0, 0)}
	var call = _object_callp(object, "set_position", [Vector2i(12, 24)])
	print("[replay S09] strict FLOAT(INT)=", float_from_int, " strict INT(FLOAT)=", int_from_float)
	print("[replay S09] strict INT(STRING)=", strict_int_from_string, " utility type_convert=", utility_int_from_string)
	print("[replay S09] var_to_str/str_to_var=", encoded, " → ", restored)
	print("[replay S09] separate Object::callp path=", call, " position=", object["position"])

# C++ 对照：Variant::construct
func _construct(type_name, source_type, value):
	if not _can_convert_strict(source_type, type_name):
		return {"ok": false, "type": type_name, "value": null, "error": "no strict constructor match"}
	if type_name == "FLOAT":
		return {"ok": true, "type": "FLOAT", "value": float(value)}
	if type_name == "INT":
		return {"ok": true, "type": "INT", "value": int(value)}
	return {"ok": true, "type": type_name, "value": value}

# C++ 对照：Variant::can_convert_strict
func _can_convert_strict(source_type, target_type):
	if source_type == target_type or target_type == "NIL":
		return true
	if source_type == "NIL":
		return target_type == "OBJECT"
	var accepted = {
		"INT": ["BOOL", "FLOAT"],
		"FLOAT": ["BOOL", "INT"],
		"STRING": ["NODE_PATH", "STRING_NAME"],
		"VECTOR2": ["VECTOR2I"],
		"VECTOR2I": ["VECTOR2"],
	}
	return accepted.has(target_type) and source_type in accepted[target_type]

# C++ 对照：VariantUtilityFunctions::type_convert
func _type_convert(value, target_type):
	if target_type == "INT":
		return {"ok": true, "type": "INT", "value": int(value)}
	if target_type == "FLOAT":
		return {"ok": true, "type": "FLOAT", "value": float(value)}
	return {"ok": false, "type": target_type, "value": null}

# C++ 对照：VariantUtilityFunctions::var_to_str / VariantWriter::write_to_string
func _var_to_str(value):
	return str(value["value"])

# C++ 对照：VariantUtilityFunctions::str_to_var / VariantParser::parse
func _str_to_var(text):
	if text.is_valid_int():
		return {"type": "INT", "value": int(text)}
	return {"type": "FLOAT", "value": float(text)}

# C++ 对照：Object::callv → Object::callp → ClassDB::get_method
func _object_callp(object, method, args):
	if method == "set_position" and args.size() == 1:
		object["position"] = args[0]
		return {"error": "OK", "return": null}
	return {"error": "invalid method/arguments", "return": null}
