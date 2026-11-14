extends Reference

# Viewport::_gui_find_control_at_pos → _gui_input_event → Control input_event/focus → accept_event
var state = {}

func run_model():
	print("[S31 replay Godot 2] Viewport 路由、坐标与输入捕获")
	state = {"focus": "none", "handled": false, "target": "front_button"}
	var target = _find_control_at_pos(Vector2(48, 32))
	_update_focus(target)
	_dispatch_gui_event(target)
	_accept_event()

func _find_control_at_pos(point):
	# 面板与按钮重叠时，先命中上层候选。
	print("[hit-test] point=", point, " -> ", state["target"])
	return state["target"]

func _update_focus(target):
	state["focus"] = target
	print("[focus] focused Control=", state["focus"])

func _dispatch_gui_event(target):
	state["handled"] = false
	print("[gui-dispatch] target=", target, " handled=", state["handled"])

func _accept_event():
	state["handled"] = true
	print("[accept_event] later input stage allowed=", not state["handled"])
