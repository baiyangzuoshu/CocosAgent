# 本课 C++ 调用路径的 GDScript 教学复刻，不是 Godot 引擎实现。
extends RefCounted

# Deterministic miniature of fixed-step accumulation, then idle and draw.
func run():
	var frame_delta = 0.055
	var fixed_slice = 0.02
	var accumulated = frame_delta
	var fixed_ticks = 0
	while accumulated >= fixed_slice:
		_fixed_iteration(fixed_ticks)
		fixed_ticks += 1
		accumulated -= fixed_slice
	_idle_iteration(frame_delta)
	_sync_and_draw()
	print("[replay S05] fixed ticks=", fixed_ticks, " remainder=", accumulated)
	print("[replay S05] source boundaries: real time delta, clamp and draw policy are platform/runtime state")

func _fixed_iteration(index):
	print("[replay S05] fixed #", index, ": physics sync → MainLoop.iteration → physics step → message flush")

func _idle_iteration(delta):
	print("[replay S05] idle delta=", delta, ": MainLoop.idle")

func _sync_and_draw():
	print("[replay S05] VisualServer sync → draw → audio update")
