# 本课 C++ 调用路径的 GDScript 教学复刻，不是 Godot 引擎实现。
extends Reference

# Replays the selected desktop path: platform run → Main setup/start → main loop.
func run():
	var phases = []
	_enter_phase(phases, "platform main() selects OS implementation")
	_enter_phase(phases, "OS::run enters native event loop")
	_enter_phase(phases, "Main::setup initializes core and project")
	_enter_phase(phases, "Main::start loads and installs main scene")
	_enter_phase(phases, "MainLoop::initialize enters SceneTree")
	_enter_phase(phases, "root Node sends READY and GDScript _ready runs")
	for phase in phases:
		print("[replay S01] ", phase)

func _enter_phase(phases, value):
	phases.append(value)
