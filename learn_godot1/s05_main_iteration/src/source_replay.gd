# S05 Godot 1.1: fixed slice accumulator → MainLoop iteration/idle → VisualServer.
extends Reference

func run():
	var frame = {"time_accum": 0.0, "physics_ticks": 0, "process_step": 0.0, "events": []}
	_advance_clock(frame, 0.055, 0.020)
	while frame["time_accum"] > 0.020:
		frame["time_accum"] -= 0.020
		_fixed_iteration(frame, frame["physics_ticks"], 0.020)
		frame["physics_ticks"] += 1
	_idle_and_submit(frame, frame["process_step"], true)
	print("[replay S05] fixed callbacks=", frame["physics_ticks"], " carried time=", frame["time_accum"])
	for event in frame["events"]:
		print("[replay S05] ", event)

func _advance_clock(frame, os_delta, fixed_slice):
	var step = min(os_delta, fixed_slice * 8.0)
	frame["time_accum"] += step
	frame["process_step"] = step
	frame["events"].append("OS ticks produce step=" + str(step) + "; add to time_accum")

func _fixed_iteration(frame, index, fixed_slice):
	frame["events"].append("fixed #" + str(index) + ": VisualServer sync/physics flush → MainLoop::iteration(" + str(fixed_slice) + ") → PhysicsServer step → MessageQueue flush")

func _idle_and_submit(frame, step, can_draw):
	frame["events"].append("MainLoop::idle(" + str(step) + ") once after fixed loop")
	if can_draw:
		frame["events"].append("VisualServer::draw commits frame")
	else:
		frame["events"].append("VisualServer::flush without draw")
	frame["events"].append("AudioServer updates after drawing")
