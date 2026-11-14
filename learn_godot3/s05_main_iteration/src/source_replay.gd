# S05 Godot 3.6: MainTimerSync accumulator plus Main::iteration physics cap.
extends Reference

# 教学复刻：逐段实现 Godot 3.6 MainTimerSync::advance_core 的 12 帧典型步数约束，
# 再重现 Main::iteration 的 8 步上限和固定/idle 顺序。OS 与服务器副作用用账本替代。

# 教学脚手架：按本课顺序组装输入、执行模型并打印观察结果。
func run():
	var clock = _new_clock()
	var frame = _advance_checked(clock, 0.020, 50, 0.055, 0.5)
	_apply_frame_cap(frame, 8)
	for i in range(frame["physics_steps"]):
		_physics_tick(frame, i, 0.020)
	_idle_draw(frame)
	print("[replay S05] physics_steps=", frame["physics_steps"], " idle_step=", frame["idle_step"], " remainder=", clock["time_accum"], " interpolation=", frame["interpolation"])
	var overloaded_clock = _new_clock()
	var overloaded = _advance_checked(overloaded_clock, 0.020, 50, 0.300, 0.5)
	_apply_frame_cap(overloaded, 8)
	print("[replay S05] 300 ms frame: capped ticks=", overloaded["physics_steps"], " corrected idle step=", overloaded["idle_step"], " remainder=", overloaded_clock["time_accum"])
	for event in frame["events"]:
		print("[replay S05] ", event)

# C++ 对照：MainTimerSync 构造函数初始化 CONTROL_STEPS 数组
func _new_clock():
	var clock = {"time_accum": 0.0, "time_deficit": 0.0, "typical": [], "accumulated": []}
	for i in range(12):
		clock["typical"].append(i)
		clock["accumulated"].append(i)
	return clock

# C++ 对照：MainTimerSync::advance_core
func _advance_core(clock, frame_slice, iterations_per_second, idle_step, jitter_fix):
	clock["time_accum"] += idle_step
	var steps = int(floor(clock["time_accum"] * iterations_per_second))
	var min_steps = clock["typical"][0]
	var max_steps = min_steps + 1
	var update_typical = false
	for i in range(11):
		var left = clock["typical"][i + 1] - clock["accumulated"][i]
		if left > max_steps or left + 1 < min_steps:
			update_typical = true
			break
		if left > min_steps:
			min_steps = left
		if left + 1 < max_steps:
			max_steps = left + 1
	if steps < min_steps:
		var possible = int(floor(clock["time_accum"] * iterations_per_second + jitter_fix))
		if possible < min_steps:
			steps = possible
			update_typical = true
		else:
			steps = min_steps
	elif steps > max_steps:
		var possible = int(floor(clock["time_accum"] * iterations_per_second - jitter_fix))
		if possible > max_steps:
			steps = possible
			update_typical = true
		else:
			steps = max_steps
	if steps < 0:
		steps = 0
	clock["time_accum"] -= steps * frame_slice
	for offset in range(12):
		var i = 11 - offset
		if i > 0:
			clock["accumulated"][i] = clock["accumulated"][i - 1] + steps
		else:
			clock["accumulated"][0] = steps
	if update_typical:
		for offset in range(12):
			var i = 11 - offset
			if clock["typical"][i] > clock["accumulated"][i]:
				clock["typical"][i] = clock["accumulated"][i]
			elif clock["typical"][i] < clock["accumulated"][i] - 1:
				clock["typical"][i] = clock["accumulated"][i] - 1
	return {"physics_steps": steps, "idle_step": idle_step, "frame_slice": frame_slice, "time_scale": 1.0, "interpolation": clock["time_accum"] / frame_slice, "events": ["advance_core: floor(accum * ips), constrain to 12-frame typical window, subtract chosen slices"]}

# C++ 对照：MainTimerSync::get_average_physics_steps
func _get_average_physics_steps(clock):
	var min_average = clock["typical"][0]
	var max_average = min_average + 1.0
	for i in range(1, 12):
		var lower = clock["typical"][i]
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
func _advance_checked(clock, frame_slice, iterations_per_second, input_step, jitter_fix):
	var min_output_step = max(input_step / 8.0, 0.000001)
	var adjusted_input = input_step + clock["time_deficit"]
	var frame = _advance_core(clock, frame_slice, iterations_per_second, adjusted_input, jitter_fix)
	var idle_minus_accum = frame["idle_step"] - clock["time_accum"]
	var average = _get_average_physics_steps(clock)
	if average["count"] > 3:
		frame["idle_step"] = _clamp_value(frame["idle_step"], average["min"] * frame_slice, average["max"] * frame_slice)
	frame["idle_step"] = _clamp_value(frame["idle_step"], adjusted_input - jitter_fix * frame_slice, adjusted_input + jitter_fix * frame_slice)
	frame["idle_step"] = _clamp_value(frame["idle_step"], idle_minus_accum, idle_minus_accum + frame_slice)
	if frame["idle_step"] < min_output_step:
		frame["idle_step"] = min_output_step
	clock["time_accum"] = frame["idle_step"] - idle_minus_accum
	if clock["time_accum"] > frame_slice:
		var extra_steps = int(floor(clock["time_accum"] * iterations_per_second))
		clock["time_accum"] -= extra_steps * frame_slice
		frame["physics_steps"] += extra_steps
	clock["time_deficit"] = adjusted_input - frame["idle_step"]
	frame["interpolation"] = clock["time_accum"] / frame_slice
	frame["events"].append("advance_checked: average-window, jitter-window, accumulator-window clamps; carry time_deficit=" + str(clock["time_deficit"]))
	return frame

# 教学辅助：把 C++ 的 clamp_idle(min, max) 写成标量形式
func _clamp_value(value, lower, upper):
	if value < lower:
		return lower
	if value > upper:
		return upper
	return value

# C++ 对照：Main::iteration max_physics_steps_per_frame
func _apply_frame_cap(frame, max_steps):
	if frame["physics_steps"] > max_steps:
		var excess = frame["physics_steps"] - max_steps
		frame["physics_steps"] = max_steps
		frame["idle_step"] -= excess * frame["frame_slice"]
		frame["events"].append("Main::iteration caps physics ticks and subtracts excess time from idle step")

# C++ 对照：MainLoop::iteration / PhysicsServer::step
func _physics_tick(frame, index, fixed_step):
	frame["events"].append("physics #" + str(index) + ": iteration_prepare → Physics2D sync/flush → MainLoop::iteration(" + str(fixed_step * frame["time_scale"]) + ") → Navigation → server steps → message flush → iteration_end")

# C++ 对照：MainLoop::idle / VisualServer sync and draw
func _idle_draw(frame):
	frame["events"].append("MainLoop::idle(" + str(frame["idle_step"] * frame["time_scale"]) + ") → callbacks/message flush → VisualServer sync")
	frame["events"].append("draw only when can_draw and render loop enabled; AudioServer::update follows")
