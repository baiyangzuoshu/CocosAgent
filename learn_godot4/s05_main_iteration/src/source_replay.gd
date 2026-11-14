# S05 Godot 4.7: MainTimerSync chooses ticks; Main applies project max-steps cap.
extends RefCounted

func run():
	var timer = {"accum": 0.0, "deficit": 0.0, "history": [], "events": []}
	var frame = _advance_core(timer, 0.055, 0.020)
	_limit_physics_steps(frame, 8)
	for tick in range(frame["physics_steps"]):
		_physics_process_tick(frame, tick, 0.020)
	_process_and_draw(frame)
	print("[replay S05] physics=", frame["physics_steps"], " process_step=", frame["process_step"], " remainder=", frame["remainder"], " interpolation=", frame["interpolation"])
	for event in frame["events"]:
		print("[replay S05] ", event)

func _advance_core(timer, elapsed, physics_step):
	timer["accum"] += elapsed
	var count = int(floor(timer["accum"] / physics_step))
	timer["accum"] -= count * physics_step
	timer["history"].append(count)
	if timer["history"].size() > 12:
		timer["history"].pop_front()
	return {"physics_steps": count, "process_step": elapsed, "remainder": timer["accum"], "interpolation": timer["accum"] / physics_step, "events": ["MainTimerSync::advance_core selects fixed tick count", "advance_checked applies time_deficit and delta correction"]}

func _limit_physics_steps(frame, max_steps):
	if frame["physics_steps"] > max_steps:
		var excess = frame["physics_steps"] - max_steps
		frame["physics_steps"] = max_steps
		frame["process_step"] -= excess * 0.020
		frame["events"].append("Main::iteration applies max_physics_steps_per_frame and adjusts process_step")

func _physics_process_tick(frame, index, fixed_step):
	frame["events"].append("physics #" + str(index) + ": sync → MainLoop::physics_process → PhysicsServer step → iteration_end")

func _process_and_draw(frame):
	frame["events"].append("MainLoop::process(" + str(frame["process_step"]) + ") after fixed ticks")
	frame["events"].append("RenderingServer::sync then draw when presentation/resources require it")
