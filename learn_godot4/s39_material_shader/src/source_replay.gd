extends RefCounted

# BaseMaterial3D shader update / ShaderMaterial parameter → Material RID → server synchronization
var state = {}

func run_model():
	print("[S39 replay Godot 4] Mesh、Material 与 Shader 的绘制准备")
	state = {"material": {"albedo": Color(1, 1, 1), "roughness": 0.5}, "dirty": false, "shader_generation": 1}
	_set_parameter("albedo", Color(1, 0.2, 0.2))
	_mark_dirty()
	_sync_material_rid()

func _set_parameter(key, value):
	state["material"][key] = value
	print("[material parameter] ", key, "=", value)

func _mark_dirty():
	state["dirty"] = true
	print("[material dirty] shader update pending")

func _sync_material_rid():
	if state["dirty"]:
		state["shader_generation"] += 1
		state["dirty"] = false
	print("[material sync model] generation=", state["shader_generation"])
