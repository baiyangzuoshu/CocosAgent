extends Node

var replay_script = preload("res://src/source_replay.gd")
var first_button
var second_button

func _ready():
	print("[Godot 3 S31] Control 命中测试、焦点与 GUI 输入")
	var replay = replay_script.new()
	replay.run_model()
	_run_experiment()

func _run_experiment():
	var row = HBoxContainer.new()
	row.rect_position = Vector2(24, 32)
	row.rect_size = Vector2(520, 56)
	self.add_child(row)
	first_button = Button.new()
	first_button.text = "Button A"
	first_button.focus_mode = Control.FOCUS_ALL
	first_button.connect("pressed", self, "_on_first_pressed")
	row.add_child(first_button)
	second_button = Button.new()
	second_button.text = "Button B"
	second_button.focus_mode = Control.FOCUS_ALL
	second_button.connect("pressed", self, "_on_second_pressed")
	row.add_child(second_button)
	first_button.grab_focus()
	print("Experiment: click A/B; press Tab to move focus between the two Controls.")

func _on_first_pressed():
	print("[Button A pressed] focus A=", first_button.has_focus())

func _on_second_pressed():
	print("[Button B pressed] focus B=", second_button.has_focus())


