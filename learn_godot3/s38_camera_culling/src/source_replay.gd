extends Reference

# Camera::make_current / projection → VisualServerScene::render_camera → _cull_convex_from_point
var state = {}

func run_model():
	print("[S38 replay Godot 3] 相机、视锥裁剪和可见对象收集")
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
