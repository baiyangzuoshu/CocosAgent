extends Reference

# Camera::make_current / projection → VisualServerRaster camera state → instances_cull_convex
var state = {}

func run_model():
	print("[S39 replay Godot 2] 相机可见性、裁剪和场景遍历")
	state = {"near": 0.1, "far": 50.0, "camera_z": 0.0, "objects": [{"name": "inside", "z": -5.0}, {"name": "outside", "z": -80.0}], "visible": []}
	_make_projection()
	_collect_visible()

func _make_projection():
	print("[camera projection] near=", state["near"], " far=", state["far"])

func _collect_visible():
	for item in state["objects"]:
		_test_bounds(item)
	print("[visible instances] ", state["visible"])

func _test_bounds(item):
	var distance = abs(item["z"] - state["camera_z"])
	if distance >= state["near"] and distance <= state["far"]:
		state["visible"].append(item["name"])
	print("[simplified bounds] ", item["name"], " distance=", distance)
