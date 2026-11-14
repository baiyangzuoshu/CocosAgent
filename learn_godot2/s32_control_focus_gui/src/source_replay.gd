extends Reference

# Control focus_mode → grab_focus / find_next_valid_focus → GUI event acceptance
var state = {}

func run_model():
	print("[S32 replay Godot 2] Control 命中、焦点导航与 GUI 事件")
	state = {"focus": "none", "focus_order": ["first", "second"], "handled": false}
	_set_focus_mode("all")
	_grab_focus("first")
	_move_focus(1)
	_dispatch_gui_event("second")
	_accept_event()

func _set_focus_mode(mode):
	state["focus_mode"] = mode
	print("[focus mode] ", mode)

func _grab_focus(target):
	state["focus"] = target
	print("[focus owner] ", state["focus"])

func _move_focus(index):
	state["focus"] = state["focus_order"][index]
	print("[next valid focus] ", state["focus"])

func _dispatch_gui_event(target):
	state["handled"] = false
	print("[GUI input] target=", target)

func _accept_event():
	state["handled"] = true
	print("[accept_event] later input allowed=", not state["handled"])
