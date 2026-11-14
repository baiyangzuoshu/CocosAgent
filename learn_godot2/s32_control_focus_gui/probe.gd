extends Node

var replay_script = preload("res://src/source_replay.gd")

func _ready():
	print("[Godot 2 S32] Control 命中、焦点导航与 GUI 事件")
	var replay = replay_script.new()
	replay.run_model()
	_run_experiment()

func _run_experiment():
	var row = HBoxContainer.new()
	add_child(row)
	var first = Button.new()
	first.set_text("Focus target 1")
	first.set_focus_mode(Control.FOCUS_ALL)
	row.add_child(first)
	var second = Button.new()
	second.set_text("Focus target 2")
	second.set_focus_mode(Control.FOCUS_ALL)
	row.add_child(second)
	first.grab_focus()
	print("first has focus=", first.has_focus())
	print("Experiment: press Tab or arrow keys to move focus between buttons.")

