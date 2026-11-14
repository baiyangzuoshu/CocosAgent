extends Reference

# VisualServerRaster::draw → viewport draw → RasterizerGLES2/GLES3 begin_frame/end_frame
var state = {}

func run_model():
	print("[S40 replay Godot 3] GLES 后端选择和渲染提交路径")
	state = {"phases": [], "submitted": false}
	_begin_frame()
	_draw_viewports()
	_flush()
	_submit()
	print("[frame sequence] ", state["phases"])

func _begin_frame():
	state["phases"].append("begin")

func _draw_viewports():
	state["phases"].append("viewport draw")

func _flush():
	state["phases"].append("backend flush")

func _submit():
	state["phases"].append("submit/present boundary")
	state["submitted"] = true
