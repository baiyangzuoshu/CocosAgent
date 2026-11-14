extends RefCounted

# RendererCanvasCull::_render_canvas_item_tree / _cull_canvas_item → RendererViewport::_draw_viewport
var state = {}

func run_model():
	print("[S36 replay Godot 4] 2D 画布可见性、排序与绘制")
	state = {"items": [{"name": "back", "z": 0, "visible": true}, {"name": "front", "z": 1, "visible": true}], "draw_order": []}
	_collect_canvas_items()
	_cull_items()
	_sort_items()
	_draw_canvas()

func _collect_canvas_items():
	print("[canvas tree] children=", state["items"].size())

func _cull_items():
	var visible_items = []
	for item in state["items"]:
		if item["visible"]:
			visible_items.append(item)
	state["items"] = visible_items
	print("[cull] visible count=", state["items"].size())

func _sort_items():
	state["draw_order"] = ["back", "front"]
	print("[sort] draw order=", state["draw_order"])

func _draw_canvas():
	print("[canvas draw] ", state["draw_order"])
