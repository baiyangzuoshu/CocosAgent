extends Reference

# Viewport::_make_input_local → canvas transform inverse → local InputEvent; OS window remains outside scene tree
var state = {}

func run_model():
	print("[S33 replay Godot 3] Window、Viewport 与屏幕坐标关系")
	state = {"screen": Vector2(250, 150), "window_offset": Vector2(10, 20), "stretch": Vector2(2, 2), "canvas": Vector2(30, 40)}
	_update_stretch_transform()
	_make_input_local()
	_apply_canvas_transform()

func _update_stretch_transform():
	state["viewport"] = (state["screen"] - state["window_offset"]) / state["stretch"]
	print("[stretch] viewport point=", state["viewport"])

func _make_input_local():
	state["local"] = state["viewport"]
	print("[input-local] copied event point=", state["local"])

func _apply_canvas_transform():
	state["local"] = state["local"] - state["canvas"]
	print("[canvas-inverse] simplified local point=", state["local"])
