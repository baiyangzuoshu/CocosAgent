extends Reference

# VisualServerRaster::draw → _draw_viewports → Rasterizer::flush_frame → GLES2 begin/end_frame
var state = {}

func run_model():
	print("[S40 replay Godot 1] 光栅化后端、命令刷新与一帧绘制")
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
