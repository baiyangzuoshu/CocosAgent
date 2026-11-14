extends Reference

# FixedMaterial parameter → Material RID; Light::set_color/set_parameter → VisualServerRaster light state
var state = {}

func run_model():
	print("[S40 replay Godot 2] 材质、shader、灯光与绘制状态")
	state = {"material": {"albedo": Color(1, 1, 1), "roughness": 0.5}, "dirty": false, "shader_generation": 1, "light_color": Color(1, 1, 1)}
	_set_parameter("albedo", Color(1, 0.2, 0.2))
	_mark_dirty()
	_sync_material_rid()
	_update_light()

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

func _update_light():
	state["light_color"] = Color(1, 0.95, 0.8)
	print("[light server state] diffuse=", state["light_color"])
