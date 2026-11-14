extends Node

var replay_script = preload("res://src/source_replay.gd")

func _ready():
	print("[Godot 3 S31] Control 命中测试、焦点与 GUI 输入")
	var replay = replay_script.new()
	replay.run_model()
	_run_experiment()

func _run_experiment():
	var button = Button.new()
	button.set_text("Click; Tab changes focus")
	button.set_focus_mode(Control.FOCUS_ALL)
	button.connect("pressed", self, "_on_button_pressed")
	self.add_child(button)
	print("Experiment: click the Button and inspect Control input/focus behavior.")

func _on_button_pressed():
	print("[Button pressed] GUI event reached the focused control")


