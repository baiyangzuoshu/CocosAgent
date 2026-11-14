# S06 Godot 1.1: SceneTree sends fixed/idle groups and routes handled input.
extends Reference

# 教学复刻模型：转译本课 C++ 摘录中的选定数据结构、分支和状态更新。
# 不调用私有 C++；真实引擎行为由本课独立 GDScript probe 观察。

# 教学脚手架：按本课顺序组装输入、执行模型并打印观察结果。
func run():
	var nodes = [
		{"name": "Root", "fixed": true, "idle": true, "input": true},
		{"name": "Worker", "fixed": true, "idle": false, "input": false},
		{"name": "Overlay", "fixed": false, "idle": true, "input": true}
	]
	var state = {"events": [], "quit": false}
	_route_input(state, nodes, false)
	_process_group(state, nodes, "fixed", "NOTIFICATION_FIXED_PROCESS", 0.02)
	_process_group(state, nodes, "idle", "NOTIFICATION_PROCESS", 0.016)
	state["quit"] = true
	state["events"].append("SceneTree::quit sets _quit; return to platform loop")
	for event in state["events"]:
		print("[replay S06] ", event)

# C++ 对照：SceneTree::input_event / Viewport 输入分发
func _route_input(state, nodes, handled):
	state["events"].append("MainLoop::input_event forwards event to Viewport")
	for node in nodes:
		if node["input"] and not handled:
			state["events"].append(node["name"] + " receives Viewport input")
			if node["name"] == "Overlay":
				handled = true
				state["events"].append("Viewport marks event handled; unhandled route stops")

# C++ 对照：SceneTree::iteration / SceneTree::idle
func _process_group(state, nodes, phase, notification, delta):
	for node in nodes:
		if node[phase]:
			state["events"].append(node["name"] + " receives " + notification + "(" + str(delta) + ")")
