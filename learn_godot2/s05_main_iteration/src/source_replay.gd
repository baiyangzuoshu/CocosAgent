# S05 Godot 2.1: clamp incoming step, consume fixed slices, then idle and draw.
extends Reference

func run():
	var frame = {"accum": 0.0, "ticks": [], "process_step": 0.0, "events": []}
	_advance_time(frame, 0.055, 0.020)
	while frame["accum"] > 0.020:
		frame["accum"] -= 0.020
		_fixed_step(frame, frame["ticks"].size(), 0.020)
	_idle_and_draw(frame, frame["process_step"], true)
	print("[replay S05] fixed count=", frame["ticks"].size(), " remainder=", frame["accum"])
	for event in frame["events"]:
		print("[replay S05] ", event)

func _advance_time(frame, timer_delta, fixed_slice):
	var step = timer_delta
	if step > fixed_slice * 8.0:
		step = fixed_slice * 8.0
	frame["accum"] += step
	frame["process_step"] = step
	frame["events"].append("Main::iteration reads OS ticks; step=" + str(step) + " accum=" + str(frame["accum"]))

func _fixed_step(frame, index, fixed_slice):
	frame["ticks"].append(fixed_slice)
	frame["events"].append("fixed #" + str(index) + ": VisualServer sync → physics flush → MainLoop::iteration → PhysicsServer::step → MessageQueue flush")

func _idle_and_draw(frame, step, can_draw):
	frame["events"].append("MainLoop::idle(" + str(step) + ") runs once after fixed loop")
	frame["events"].append("VisualServer::sync")
	if can_draw:
		frame["events"].append("VisualServer::draw")
	frame["events"].append("AudioServer::update")
