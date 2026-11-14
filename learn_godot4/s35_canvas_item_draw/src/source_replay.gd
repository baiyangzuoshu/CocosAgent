extends RefCounted

# CanvasItem::queue_redraw / draw_rect → RendererCanvasCull::canvas_item_add_rect
var state = {}

func run_model():
	print("[S35 replay Godot 4] CanvasItem 绘制命令如何提交")
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
