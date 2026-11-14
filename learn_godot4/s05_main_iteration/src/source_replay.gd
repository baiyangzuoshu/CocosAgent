# Executable teaching model of selected C++ logic; not the Godot engine implementation.
extends RefCounted

const GODOT_MAJOR = 4

# C++ focus: Main::iteration() / MainTimerSync → fixed updates → idle/process → server submission.
func run():
	var state = {"events": [], "fixed_ticks": 0, "physics_steps": 0, "process_step": 0.0, "time_accum": 0.0, "remainder": 0.0, "interpolation_fraction": 0.0, "exit": false}
	_measure_frame_time(state, 0.055, 0.02)
	while state["fixed_ticks"] < state["physics_steps"] and not state["exit"]:
		_physics_tick(state, state["fixed_ticks"], 0.02)
		state["fixed_ticks"] += 1
	_process_idle(state, state["process_step"])
	_render_frame(state, true, false, false)
	print("[replay S05] fixed ticks=", state["fixed_ticks"], " remainder=", state["remainder"], " interpolation=", state["interpolation_fraction"])
	for event in state["events"]:
		print("[replay S05] ", event)

func _measure_frame_time(state, raw_delta, fixed_step):
	var step = raw_delta
	if GODOT_MAJOR <= 2:
		# Godot 1/2 Main::iteration(): clamp one incoming step, then consume accumulated time while it exceeds a fixed slice.
		if step > fixed_step * 8.0:
			step = fixed_step * 8.0
		state["time_accum"] += step
		while state["time_accum"] > fixed_step:
			state["physics_steps"] += 1
			state["time_accum"] -= fixed_step
		state["remainder"] = state["time_accum"]
	else:
		# Godot 3/4 MainTimerSync::advance_core(): omit time smoothing and historical jitter corrections.
		state["time_accum"] += step
		var timer_steps = int(floor(state["time_accum"] / fixed_step))
		state["time_accum"] -= timer_steps * fixed_step
		state["remainder"] = state["time_accum"]
		state["interpolation_fraction"] = state["time_accum"] / fixed_step
		var max_steps = 8
		if timer_steps > max_steps:
			step -= (timer_steps - max_steps) * fixed_step
			timer_steps = max_steps
		state["physics_steps"] = timer_steps
	state["process_step"] = step
	var clock = "Main::iteration() time_accum"
	if GODOT_MAJOR >= 3:
		clock = "MainTimerSync::advance()"
	state["events"].append(clock + ": raw_delta=" + str(raw_delta) + ", physics_steps=" + str(state["physics_steps"]) + ", process_step=" + str(step) + ", remainder=" + str(state["remainder"]))

func _physics_tick(state, index, delta):
	if GODOT_MAJOR <= 2:
		state["events"].append("fixed #" + str(index) + ": sync/flush physics → MainLoop::iteration(" + str(delta) + ") → message flush → PhysicsServer step")
	else:
		var callback = "MainLoop::iteration"
		if GODOT_MAJOR == 4:
			callback = "MainLoop::physics_process"
		state["events"].append("physics #" + str(index) + ": iteration_prepare → sync/flush → " + callback + "(" + str(delta) + ") → server step → iteration_end")

func _process_idle(state, delta):
	var callback = "MainLoop::idle"
	if GODOT_MAJOR == 4:
		callback = "MainLoop::process"
	state["events"].append(callback + "(" + str(delta) + ") once after physics")

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
		state["events"].append("VisualServer::sync_and_halt around physics; sync after idle")
		if can_draw and render_loop_enabled:
			if low_processor_mode and not force_redraw and not changed:
				state["events"].append("low-processor mode skips unchanged frame")
			else:
				state["events"].append("VisualServer::draw(true, scaled_step)")
	else:
		state["events"].append("RenderingServer::sync")
		var wants_present = can_draw and render_loop_enabled
		if wants_present or pending_resources:
			if low_processor_mode and not force_redraw and not changed:
				state["events"].append("low-processor mode skips unchanged frame")
			else:
				state["events"].append("RenderingServer::draw(wants_present, scaled_step)")
