extends Reference

# VisualServerRaster::_draw_viewports → _draw_viewport → _render_canvas → _render_canvas_item_tree → Rasterizer
var state = {}

func run_model():
	print("[S36 replay Godot 1] Canvas、CanvasItem、层级与画布变换")
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
