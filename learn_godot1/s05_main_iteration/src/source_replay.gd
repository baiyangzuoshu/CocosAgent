# Executable teaching model of selected C++ logic; not the Godot engine implementation.
extends Reference

const GODOT_MAJOR = 1

# C++ focus: Main::iteration() / MainFrameTime → fixed updates → idle/process → conditional draw.
func run():
	var state = {"events": [], "fixed_ticks": 0, "physics_steps": 0, "process_step": 0.0, "remainder": 0.0, "exit": false}
	_measure_frame_time(state, 0.055, 0.02)
	while state["fixed_ticks"] < state["physics_steps"] and not state["exit"]:
		_physics_tick(state, state["fixed_ticks"], 0.02)
		state["fixed_ticks"] += 1
	_process_idle(state, state["process_step"])
	_render_frame(state, true, false, false)
	print("[replay S05] fixed ticks=", state["fixed_ticks"], " remainder=", state["remainder"])
	for event in state["events"]:
		print("[replay S05] ", event)

func _measure_frame_time(state, raw_delta, fixed_step):
	var step = raw_delta
	if GODOT_MAJOR <= 2:
		if step > fixed_step * 8.0:
			step = fixed_step * 8.0
		var accumulator = step
		while accumulator > fixed_step:
			state["physics_steps"] += 1
			accumulator -= fixed_step
		state["remainder"] = accumulator
	else:
		var ticks = int(floor(step / fixed_step))
		var max_steps = 8
		if ticks > max_steps:
			step -= (ticks - max_steps) * fixed_step
			ticks = max_steps
		state["physics_steps"] = ticks
		state["remainder"] = max(0.0, step - ticks * fixed_step)
	state["process_step"] = step
	state["events"].append("OS ticks → delta=" + str(raw_delta) + "; physics_steps=" + str(state["physics_steps"]))

func _physics_tick(state, index, delta):
	if GODOT_MAJOR <= 2:
		state["events"].append("fixed #" + str(index) + ": sync/flush physics → MainLoop::iteration(" + str(delta) + ") → message flush → PhysicsServer step")
	else:
		state["events"].append("physics #" + str(index) + ": iteration_prepare → sync/flush → MainLoop::physics_process(" + str(delta) + ") → server step → iteration_end")

func _process_idle(state, delta):
	if GODOT_MAJOR == 4:
		state["events"].append("MainLoop::process(" + str(delta) + ") once after physics")
	else:
		state["events"].append("MainLoop::idle(" + str(delta) + ") once after fixed updates")

func _render_frame(state, can_draw, low_processor_mode, pending_resources):
	var changed = true
	var force_redraw = false
	var render_loop_enabled = true
	if GODOT_MAJOR == 1:
		if not can_draw:
			state["events"].append("VisualServer::flush because OS cannot draw")
		elif low_processor_mode and not force_redraw and not changed:
			state["events"].append("low-processor mode skips unchanged frame")
		else:
			state["events"].append("VisualServer::draw flushes visual commands")
	elif GODOT_MAJOR == 2:
		state["events"].append("VisualServer::sync")
		if can_draw:
			if low_processor_mode and not force_redraw and not changed:
				state["events"].append("low-processor mode skips unchanged frame")
			else:
				state["events"].append("VisualServer::draw")
	elif GODOT_MAJOR == 3:
		state["events"].append("VisualServer::sync_and_halt before fixed loop; sync after idle")
		if can_draw and render_loop_enabled:
			if low_processor_mode and not force_redraw and not changed:
				state["events"].append("low-processor mode skips unchanged frame")
			else:
				state["events"].append("VisualServer::draw(true, scaled_step)")
	elif GODOT_MAJOR == 4:
		state["events"].append("RenderingServer::sync")
		var wants_present = can_draw and render_loop_enabled
		if wants_present or pending_resources:
			if low_processor_mode and not force_redraw and not changed:
				state["events"].append("low-processor mode skips unchanged frame")
			else:
				state["events"].append("RenderingServer::draw(wants_present, scaled_step)")
