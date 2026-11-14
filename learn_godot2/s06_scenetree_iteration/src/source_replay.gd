# 本课 C++ 调用路径的 GDScript 教学复刻，不是 Godot 引擎实现。
extends Reference

# SceneTree owns iteration order; Node callbacks are grouped, not a free-form tree walk.
func run():
	var phases = ["input_event", "iteration/fixed", "idle", "delete queue flush"]
	for phase in phases:
		_process_phase(phase)
	print("[replay S06] callback eligibility also depends on pause/process flags")

func _process_phase(phase):
	print("[replay S06] SceneTree phase: ", phase)
