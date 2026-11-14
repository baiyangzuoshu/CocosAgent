# S06 Godot 3.6: physics and idle notifications have separate post-update work.
extends Reference

# 教学复刻模型：转译本课 C++ 摘录中的选定数据结构、分支和状态更新。
# 不调用私有 C++；真实引擎行为由本课独立 GDScript probe 观察。

# 教学脚手架：按本课顺序组装输入、执行模型并打印观察结果。
func run():
	var state = {"events": [], "delete_queue": ["TemporaryNode"], "quit": false}
	var tree = [
		{"name": "Player", "physics": true, "process": true},
		{"name": "Hud", "physics": false, "process": true}
	]
	_physics_frame(state, tree, 0.02)
	_idle_frame(state, tree, 0.016)
	state["quit"] = true
	state["events"].append("SceneTree::quit records exit code; main loop reads _quit")
	for event in state["events"]:
		print("[replay S06] ", event)

# C++ 对照：SceneTree::iteration / physics_frame
func _physics_frame(state, nodes, delta):
	state["events"].append("emit physics_frame")
	_dispatch(state, nodes, "physics", "NOTIFICATION_INTERNAL_PHYSICS_PROCESS", delta)
	_dispatch(state, nodes, "physics", "NOTIFICATION_PHYSICS_PROCESS", delta)
	state["events"].append("physics Tween and transform update; flush delete queue")

# C++ 对照：SceneTree::idle / idle_frame
func _idle_frame(state, nodes, delta):
	state["events"].append("emit idle_frame")
	_dispatch(state, nodes, "process", "NOTIFICATION_INTERNAL_PROCESS", delta)
	_dispatch(state, nodes, "process", "NOTIFICATION_PROCESS", delta)
	state["events"].append("update Viewports, timers and Tween")
	state["events"].append("VisualServer::pre_draw after SceneTree idle work")

# C++ 对照：SceneTree notification dispatch → Node::_notification
func _dispatch(state, nodes, key, notification, delta):
	for node in nodes:
		if node[key]:
			state["events"].append(node["name"] + " receives " + notification + "(" + str(delta) + ")")
