# S06 Godot 2.1: fixed and idle phases dispatch different process groups.
extends Reference

# 教学复刻模型：转译本课 C++ 摘录中的选定数据结构、分支和状态更新。
# 不调用私有 C++；真实引擎行为由本课独立 GDScript probe 观察。

# 教学脚手架：按本课顺序组装输入、执行模型并打印观察结果。
func run():
	var groups = {
		"fixed_process": [{"name": "Player", "enabled": true}, {"name": "Hud", "enabled": false}],
		"idle_process": [{"name": "Player", "enabled": true}, {"name": "Hud", "enabled": true}]
	}
	var state = {"events": [], "quit": false, "delete_queue": ["TemporaryNode"]}
	_emit_fixed_frame(state, groups, 0.02)
	_emit_idle_frame(state, groups, 0.016)
	_flush_delete_queue(state)
	state["quit"] = true
	state["events"].append("SceneTree::quit sets _quit; iteration/idle return quit state")
	for event in state["events"]:
		print("[replay S06] ", event)

# C++ 对照：SceneTree::iteration / fixed_process group
func _emit_fixed_frame(state, groups, delta):
	state["events"].append("SceneTree::iteration saves fixed_process_time and emits fixed_frame")
	for item in groups["fixed_process"]:
		if item["enabled"]:
			state["events"].append(item["name"] + " receives NOTIFICATION_FIXED_PROCESS(" + str(delta) + ")")

# C++ 对照：SceneTree::idle / idle_process group
func _emit_idle_frame(state, groups, delta):
	state["events"].append("SceneTree::idle saves idle_process_time and emits idle_frame")
	for item in groups["idle_process"]:
		if item["enabled"]:
			state["events"].append(item["name"] + " receives NOTIFICATION_PROCESS(" + str(delta) + ")")
	state["events"].append("Viewport update precedes idle delete-queue cleanup")

# C++ 对照：SceneTree::idle 删除队列收尾
func _flush_delete_queue(state):
	for name in state["delete_queue"]:
		state["events"].append("delete queue frees " + name + " after process notifications")
	state["delete_queue"] = []
