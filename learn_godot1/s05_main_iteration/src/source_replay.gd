# S05 Godot 1.1: fixed slice accumulator → MainLoop iteration/idle → VisualServer.
extends Reference

# 教学复刻：按 Godot 1.1 Main::iteration 的计时、固定循环和绘制分支逐步推进状态。
# 不调用私有 C++；OS 时钟和服务器副作用由确定性输入与事件账本代替。

# 教学脚手架：按本课顺序组装输入、执行模型并打印观察结果。
func run():
	var frame = {"time_accum": 0.0, "physics_ticks": 0, "process_step": 0.0, "time_scale": 0.5, "events": []}
	_advance_clock(frame, 0.055, 0.020)
	_run_fixed_loop(frame, 0.020, false)
	_idle_and_submit(frame, true, false, true)
	print("[replay S05] fixed callbacks=", frame["physics_ticks"], " accumulator remainder=", frame["time_accum"], " idle delta=", frame["process_step"] * frame["time_scale"])
	var capped = {"time_accum": 0.0, "physics_ticks": 0, "process_step": 0.0, "time_scale": 1.0, "events": []}
	_advance_clock(capped, 0.300, 0.020)
	_run_fixed_loop(capped, 0.020, false)
	print("[replay S05] 300 ms clamps to eight slices; strict > runs=", capped["physics_ticks"], " remaining=", capped["time_accum"])
	var quitting = {"time_accum": 0.0, "physics_ticks": 0, "process_step": 0.0, "time_scale": 1.0, "events": []}
	_advance_clock(quitting, 0.055, 0.020)
	_run_fixed_loop(quitting, 0.020, true)
	print("[replay S05] quit during first fixed callback leaves accumulator=", quitting["time_accum"])
	for event in frame["events"]:
		print("[replay S05] ", event)

# C++ 对照：Main::iteration 的 tick、step 与 time_accum
func _advance_clock(frame, os_delta, fixed_slice):
	var step = os_delta
	if step > fixed_slice * 8.0:
		step = fixed_slice * 8.0
	frame["time_accum"] += step
	frame["process_step"] = step
	frame["events"].append("ticks_elapsed / 1e6 = " + str(os_delta) + "; clamp step to " + str(step) + "; time_accum=" + str(frame["time_accum"]))

# C++ 对照：Main::iteration 的 while (time_accum > frame_slice)
func _run_fixed_loop(frame, fixed_slice, return_quit_on_first_tick):
	while frame["time_accum"] > fixed_slice:
		_fixed_iteration(frame, frame["physics_ticks"], fixed_slice)
		frame["physics_ticks"] += 1
		if return_quit_on_first_tick:
			frame["events"].append("MainLoop::iteration returned quit=true; break before subtracting this slice")
			break
		frame["time_accum"] -= fixed_slice
		frame["events"].append("subtract one frame_slice; time_accum=" + str(frame["time_accum"]))

# C++ 对照：Main::iteration / MainLoop::iteration / PhysicsServer::step
func _fixed_iteration(frame, index, fixed_slice):
	frame["events"].append("fixed #" + str(index) + ": PhysicsServer sync/flush → Physics2DServer sync/flush → MainLoop::iteration(" + str(fixed_slice * frame["time_scale"]) + ")")
	frame["events"].append("if iteration continues: MessageQueue flush → PhysicsServer/Physics2DServer step → subtract slice → MessageQueue flush")

# C++ 对照：MainLoop::idle / VisualServer::draw 或 flush / AudioServer::update
func _idle_and_submit(frame, can_draw, low_processor_usage, changed):
	var idle_delta = frame["process_step"] * frame["time_scale"]
	frame["events"].append("MainLoop::idle(" + str(idle_delta) + ") uses the clamped incoming step, not the remaining accumulator")
	if can_draw and (not low_processor_usage or changed):
		frame["events"].append("VisualServer::draw flushes commands")
	elif can_draw:
		frame["events"].append("low-processor mode + unchanged scene: skip draw")
	else:
		frame["events"].append("cannot draw: VisualServer::flush")
	frame["events"].append("AudioServer::update follows draw/flush")
