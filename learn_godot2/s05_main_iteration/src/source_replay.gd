# S05 Godot 2.1: clamp incoming step, consume fixed slices, then idle and draw.
extends Reference

# 教学复刻：按 Godot 2.1 Main::iteration 的计时、固定循环和绘制分支逐步推进状态。
# 不调用私有 C++；OS 时钟和服务器副作用由确定性输入与事件账本代替。

# 教学脚手架：按本课顺序组装输入、执行模型并打印观察结果。
func run():
	var frame = {"accum": 0.0, "ticks": [], "process_step": 0.0, "time_scale": 0.5, "events": []}
	_advance_time(frame, 0.055, 0.020)
	_run_fixed_loop(frame, 0.020, false)
	_idle_and_draw(frame, true, false, true)
	print("[replay S05] fixed count=", frame["ticks"].size(), " remainder=", frame["accum"], " idle delta=", frame["process_step"] * frame["time_scale"])
	var quitting = {"accum": 0.0, "ticks": [], "process_step": 0.0, "time_scale": 1.0, "events": []}
	_advance_time(quitting, 0.055, 0.020)
	_run_fixed_loop(quitting, 0.020, true)
	print("[replay S05] quit from first fixed callback leaves accumulator=", quitting["accum"], " and ticks=", quitting["ticks"].size())
	var capped = {"accum": 0.0, "ticks": [], "process_step": 0.0, "time_scale": 1.0, "events": []}
	_advance_time(capped, 0.300, 0.020)
	_run_fixed_loop(capped, 0.020, false)
	print("[replay S05] 300 ms clamps to eight slices; strict > runs=", capped["ticks"].size(), " remaining=", capped["accum"])
	for event in frame["events"]:
		print("[replay S05] ", event)

# C++ 对照：Main::iteration 的 step 截断与 time_accum
func _advance_time(frame, timer_delta, fixed_slice):
	var step = timer_delta
	if step > fixed_slice * 8.0:
		step = fixed_slice * 8.0
	frame["accum"] += step
	frame["process_step"] = step
	frame["events"].append("ticks_elapsed / 1e6 = " + str(timer_delta) + "; clamp step to " + str(step) + "; time_accum=" + str(frame["accum"]))

# C++ 对照：Main::iteration 的 while (time_accum > frame_slice)
func _run_fixed_loop(frame, fixed_slice, return_quit_on_first_tick):
	while frame["accum"] > fixed_slice:
		_fixed_step(frame, frame["ticks"].size(), fixed_slice)
		if return_quit_on_first_tick:
			frame["events"].append("MainLoop::iteration returned quit=true; break before subtracting the slice")
			break
		frame["accum"] -= fixed_slice
		frame["events"].append("subtract frame_slice; time_accum=" + str(frame["accum"]))

# C++ 对照：MainLoop::iteration / PhysicsServer::step
func _fixed_step(frame, index, fixed_slice):
	frame["ticks"].append(fixed_slice * frame["time_scale"])
	frame["events"].append("fixed #" + str(index) + ": PhysicsServer sync/flush → Physics2DServer sync/flush → MainLoop::iteration(" + str(fixed_slice * frame["time_scale"]) + ")")
	frame["events"].append("if iteration continues: MessageQueue flush → PhysicsServer step → Physics2DServer end_sync/step → subtract slice → MessageQueue flush")

# C++ 对照：MainLoop::idle / VisualServer::draw / AudioServer::update
func _idle_and_draw(frame, can_draw, low_processor_usage, changed):
	var idle_delta = frame["process_step"] * frame["time_scale"]
	frame["events"].append("MainLoop::idle(" + str(idle_delta) + ") uses incoming step, not remaining accumulator")
	frame["events"].append("VisualServer::sync")
	if can_draw and (not low_processor_usage or changed):
		frame["events"].append("VisualServer::draw")
	elif can_draw:
		frame["events"].append("low-processor mode + unchanged scene: skip draw")
	frame["events"].append("AudioServer::update")
