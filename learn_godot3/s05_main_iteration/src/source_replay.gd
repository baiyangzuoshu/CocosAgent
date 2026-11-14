# S05 Godot 3.6: MainTimerSync accumulator plus Main::iteration physics cap.
extends Reference

func run():
	var clock = {"accum": 0.0, "deficit": 0.0, "history": [], "events": []}
	var frame = _advance_core(clock, 0.055, 0.020)
	_apply_frame_cap(frame, 8)
	for i in range(frame["physics_steps"]):
		_physics_tick(frame, i, 0.020)
	_idle_draw(frame)
	print("[replay S05] physics_steps=", frame["physics_steps"], " idle_step=", frame["idle_step"], " remainder=", frame["remainder"], " interpolation=", frame["interpolation"])
	for event in frame["events"]:
		print("[replay S05] ", event)

func _advance_core(clock, os_delta, fixed_step):
	clock["accum"] += os_delta
	var timer_steps = int(floor(clock["accum"] / fixed_step))
	clock["accum"] -= timer_steps * fixed_step
	clock["history"].append(timer_steps)
	if clock["history"].size() > 12:
		clock["history"].pop_front()
	return {"physics_steps": timer_steps, "idle_step": os_delta, "remainder": clock["accum"], "interpolation": clock["accum"] / fixed_step, "events": ["MainTimerSync::advance_core accumulates time and keeps 12-frame tick history", "advance_checked corrects idle step from time_deficit"]}

func _apply_frame_cap(frame, max_steps):
	if frame["physics_steps"] > max_steps:
		var excess = frame["physics_steps"] - max_steps
		frame["physics_steps"] = max_steps
		frame["idle_step"] -= excess * 0.020
		frame["events"].append("Main::iteration caps physics ticks and subtracts excess time from idle step")

func _physics_tick(frame, index, fixed_step):
	frame["events"].append("physics #" + str(index) + ": MainLoop::iteration → Physics2D/PhysicsServer step → message flush")

func _idle_draw(frame):
	frame["events"].append("MainLoop::idle(" + str(frame["idle_step"]) + ") once; VisualServer sync/draw follows")
