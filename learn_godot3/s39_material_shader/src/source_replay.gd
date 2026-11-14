extends Reference

# Material3D::_update_shader / set_albedo → ShaderMaterial parameter → VisualServer material RID
var state = {}

func run_model():
	print("[S39 replay Godot 3] Mesh、Material、Shader 与渲染状态")
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
