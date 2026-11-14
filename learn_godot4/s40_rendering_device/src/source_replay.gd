extends RefCounted

# RenderingServerDefault::draw → _draw → RendererViewport::draw_viewports → RenderingDevice draw_list_end/submit
var state = {}

func run_model():
	print("[S40 replay Godot 4] RenderingDevice 与图形后端提交")
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
