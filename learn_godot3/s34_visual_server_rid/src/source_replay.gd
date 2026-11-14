extends Reference

# VisualServer interface → Rasterizer/RID owner → VisualServerRaster::free
var state = {}

func run_model():
	print("[S34 replay Godot 3] VisualServer、RID 与场景层抽象")
	state = {"next_rid": 1, "resources": {}}
	var rid = _alloc_rid("canvas_item")
	_set_server_state(rid, "parent_canvas")
	_free_rid(rid)

func _alloc_rid(kind):
	var rid = state["next_rid"]
	state["next_rid"] += 1
	state["resources"][rid] = kind
	print("[RID allocate] ", rid, " -> ", kind)
	return rid

func _set_server_state(rid, value):
	if state["resources"].has(rid):
		state["resources"][rid] = value
	print("[server update] RID=", rid, " state=", value)

func _free_rid(rid):
	state["resources"].erase(rid)
	print("[RID free] live=", state["resources"].size())
