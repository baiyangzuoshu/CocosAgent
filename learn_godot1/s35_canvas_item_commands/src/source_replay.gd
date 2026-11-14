extends Reference

# CanvasItem::update → NOTIFICATION_DRAW / draw_rect → VisualServerRaster::canvas_item_add_rect
var state = {}

func run_model():
	print("[S35 replay Godot 1] 2D 绘制命令如何提交给服务器")
	state = {"redraw_queued": false, "commands": []}
	_queue_redraw()
	_draw_rect()
	_submit_command()

func _queue_redraw():
	state["redraw_queued"] = true
	print("[CanvasItem] redraw queued; no rectangle submitted yet")

func _draw_rect():
	if state["redraw_queued"]:
		state["commands"].append({"op": "rect", "position": Vector2(10, 10), "size": Vector2(80, 40)})
		state["redraw_queued"] = false
		print("[NOTIFICATION_DRAW] command count=", state["commands"].size())

func _submit_command():
	print("[server command] ", state["commands"][0])
