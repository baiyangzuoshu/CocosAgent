extends RefCounted

# Control minimum-size cache / anchors → Container::queue_sort deferred → Theme item notification
var state = {}

func run_model():
	print("[S32 replay Godot 4] 锚点、Container 布局与主题")
	state = {"child_min": Vector2(120, 32), "parent_min": Vector2(0, 0), "sort_queued": false, "theme_dirty": false}
	_update_minimum_size_cache()
	_queue_sort()
	_sort_children()
	_theme_changed()

func _update_minimum_size_cache():
	state["parent_min"] = state["child_min"]
	print("[minimum-size] parent cache=", state["parent_min"])

func _queue_sort():
	state["sort_queued"] = true
	print("[layout] one deferred sort queued")

func _sort_children():
	if state["sort_queued"]:
		state["sort_queued"] = false
		print("[container] children arranged from cached minimum size")

func _theme_changed():
	state["theme_dirty"] = true
	print("[theme] item changed; dependent Control will refresh")
