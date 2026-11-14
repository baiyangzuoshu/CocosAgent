# S05 Godot 4.7: MainTimerSync chooses ticks; Main applies project max-steps cap.
extends RefCounted

# 教学复刻：实现 Godot 4.7 MainTimerSync::advance_core 的 12 帧典型步数约束，
# 再跟踪 Main::iteration 的 max_physics_steps_per_frame、固定回调与绘制门控。
# OS 时钟、服务器同步和 GPU 提交以确定性输入与事件账本表示。

# 教学脚手架：按本课顺序组装输入、执行模型并打印观察结果。
func run():
	var timer = _new_timer()
	var frame = _advance_checked(timer, 0.020, 50, 0.055, 0.5)
	_limit_physics_steps(frame, 8)
	for tick in range(frame["physics_steps"]):
		_physics_process_tick(frame, tick, 0.020, false)
	_process_and_draw(frame, true, true, true, true, true, false)
	print("[replay S05] physics=", frame["physics_steps"], " process_step=", frame["process_step"], " remainder=", timer["time_accum"], " interpolation=", frame["interpolation"])
	var exiting_frame = {"events": [], "time_scale": 1.0}
	_physics_process_tick(exiting_frame, 0, 0.020, true)
	print("[replay S05] MainLoop quit during physics skips server step=", exiting_frame["events"])
	var sleeping_timer = _new_timer()
	var sleeping = _advance_checked(sleeping_timer, 0.020, 50, 0.020, 0.5)
	_process_and_draw(sleeping, true, true, false, true, false, false)
	var overloaded_timer = _new_timer()
	var overloaded = _advance_checked(overloaded_timer, 0.020, 50, 0.300, 0.5)
	_limit_physics_steps(overloaded, 8)
	print("[replay S05] 300 ms frame: capped ticks=", overloaded["physics_steps"], " corrected process_step=", overloaded["process_step"], " remainder=", overloaded_timer["time_accum"])
	for event in frame["events"]:
		print("[replay S05] ", event)

# C++ 对照：MainTimerSync 构造函数初始化 CONTROL_STEPS 数组
func _new_timer():
	var timer = {"time_accum": 0.0, "time_deficit": 0.0, "typical": [], "accumulated": []}
	for i in range(12):
		timer["typical"].append(i)
		timer["accumulated"].append(i)
	return timer

# C++ 对照：MainTimerSync::advance_core
func _advance_core(timer, physics_step, ticks_per_second, process_step, jitter_fix):
	timer["time_accum"] += process_step
	var steps = int(floor(timer["time_accum"] * ticks_per_second))
	var min_steps = timer["typical"][0]
	var max_steps = min_steps + 1
	var update_typical = false
	for i in range(11):
		var left = timer["typical"][i + 1] - timer["accumulated"][i]
		if left > max_steps or left + 1 < min_steps:
			update_typical = true
			break
		if left > min_steps:
			min_steps = left
		if left + 1 < max_steps:
			max_steps = left + 1
	if steps < min_steps:
		var possible = int(floor(timer["time_accum"] * ticks_per_second + jitter_fix))
		if possible < min_steps:
			steps = possible
			update_typical = true
		else:
			steps = min_steps
	elif steps > max_steps:
		var possible = int(floor(timer["time_accum"] * ticks_per_second - jitter_fix))
		if possible > max_steps:
			steps = possible
			update_typical = true
		else:
			steps = max_steps
	if steps < 0:
		steps = 0
	timer["time_accum"] -= steps * physics_step
	for offset in range(12):
		var i = 11 - offset
		if i > 0:
			timer["accumulated"][i] = timer["accumulated"][i - 1] + steps
		else:
			timer["accumulated"][0] = steps
	if update_typical:
		for offset in range(12):
			var i = 11 - offset
			if timer["typical"][i] > timer["accumulated"][i]:
				timer["typical"][i] = timer["accumulated"][i]
			elif timer["typical"][i] < timer["accumulated"][i] - 1:
				timer["typical"][i] = timer["accumulated"][i] - 1
	return {"physics_steps": steps, "process_step": process_step, "physics_step": physics_step, "time_scale": 1.0, "interpolation": timer["time_accum"] / physics_step, "events": ["advance_core: floor(accum * ticks_per_second), constrain to 12-frame typical window, subtract chosen slices"]}

# C++ 对照：MainTimerSync::get_average_physics_steps
func _get_average_physics_steps(timer):
	var min_average = timer["typical"][0]
	var max_average = min_average + 1.0
	for i in range(1, 12):
		var lower = timer["typical"][i]
		var current_min = float(lower) / float(i + 1)
		if current_min > max_average:
			return {"count": i, "min": min_average, "max": max_average}
		elif current_min > min_average:
			min_average = current_min
		var current_max = float(lower + 1) / float(i + 1)
		if current_max < min_average:
			return {"count": i, "min": min_average, "max": max_average}
		elif current_max < max_average:
			max_average = current_max
	return {"count": 12, "min": min_average, "max": max_average}

# C++ 对照：MainTimerSync::advance_checked（普通可变 FPS 路径）
func _advance_checked(timer, physics_step, ticks_per_second, input_step, jitter_fix):
	var min_output_step = max(input_step / 8.0, 0.000001)
	var adjusted_input = input_step + timer["time_deficit"]
	var frame = _advance_core(timer, physics_step, ticks_per_second, adjusted_input, jitter_fix)
	var process_minus_accum = frame["process_step"] - timer["time_accum"]
	var average = _get_average_physics_steps(timer)
	if average["count"] > 3:
		frame["process_step"] = _clamp_value(frame["process_step"], average["min"] * physics_step, average["max"] * physics_step)
	frame["process_step"] = _clamp_value(frame["process_step"], adjusted_input - jitter_fix * physics_step, adjusted_input + jitter_fix * physics_step)
	frame["process_step"] = _clamp_value(frame["process_step"], process_minus_accum, process_minus_accum + physics_step)
	if frame["process_step"] < min_output_step:
		frame["process_step"] = min_output_step
	timer["time_accum"] = frame["process_step"] - process_minus_accum
	if timer["time_accum"] > physics_step:
		var extra_steps = int(floor(timer["time_accum"] * ticks_per_second))
		timer["time_accum"] -= extra_steps * physics_step
		frame["physics_steps"] += extra_steps
	timer["time_deficit"] = adjusted_input - frame["process_step"]
	frame["interpolation"] = timer["time_accum"] / physics_step
	frame["events"].append("advance_checked: average-window, jitter-window, accumulator-window clamps; carry time_deficit=" + str(timer["time_deficit"]))
	return frame

# 教学辅助：对应 MainFrameTime::clamp_process_step
func _clamp_value(value, lower, upper):
	if value < lower:
		return lower
	if value > upper:
		return upper
	return value

# C++ 对照：Main::iteration max_physics_steps_per_frame
func _limit_physics_steps(frame, max_steps):
	if frame["physics_steps"] > max_steps:
		var excess = frame["physics_steps"] - max_steps
		frame["physics_steps"] = max_steps
		frame["process_step"] -= excess * frame["physics_step"]
		frame["events"].append("Main::iteration applies max_physics_steps_per_frame and adjusts process_step")

# C++ 对照：MainLoop::physics_process / PhysicsServer::step
func _physics_process_tick(frame, index, fixed_step, main_loop_quits):
	frame["events"].append("physics #" + str(index) + ": optional buffered-input flush → Engine enters physics → iteration_prepare → PhysicsServer3D/2D sync and flush_queries")
	frame["events"].append("MainLoop::physics_process(" + str(fixed_step * frame["time_scale"]) + ")")
	if main_loop_quits:
		frame["events"].append("quit=true: end server sync, clear Engine physics flag, break before navigation/server step and iteration_end")
		return true
	frame["events"].append("navigation physics → message flush → PhysicsServer3D/2D end_sync and step → message flush → iteration_end → clear Engine physics flag")
	return false

# C++ 对照：MainLoop::process / RenderingServer sync and draw
func _process_and_draw(frame, can_present, render_loop_enabled, has_pending_resources, low_processor_usage, has_changed, force_redraw):
	frame["events"].append("MainLoop::process(" + str(frame["process_step"] * frame["time_scale"]) + ") after fixed ticks; flush message queue")
	frame["events"].append("NavigationServer2D/3D::process before rendering")
	frame["events"].append("RenderingServer::sync before draw")
	var wants_present = can_present and render_loop_enabled
	if wants_present or has_pending_resources:
		if low_processor_usage and not force_redraw:
			if has_changed:
				frame["events"].append("low-processor mode + changed scene: RenderingServer::draw")
			else:
				frame["events"].append("low-processor mode + unchanged scene: skip draw")
		else:
			frame["events"].append("RenderingServer::draw(wants_present, scaled_step)")
	else:
		frame["events"].append("no presentation/pending resources: skip draw")
	frame["events"].append("GDExtensionManager::frame → ScriptServer language frames → AudioServer::update")
