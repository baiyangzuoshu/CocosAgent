extends Node

var elapsed = 0.0
var idle_reported = false
var fixed_reported = false
var quit_requested = false

func _ready():
	# Run the lesson's miniature source replica before probing the real engine API.
	var replay = load("res://src/source_replay.gd").new()
	replay.run()
	set_process(true)
	set_fixed_process(true)
	set_process_input(true)
	print("S06 SceneTree probe ready")

func _input(event):
	print("S06 input event reached Node")

func _process(delta):
	elapsed += delta
	if not idle_reported:
		idle_reported = true
		print("first idle delta: ", delta)
	if elapsed >= 5.0 and not quit_requested:
		quit_requested = true
		print("S06 calling SceneTree.quit()")
		get_tree().quit()

func _fixed_process(delta):
	if not fixed_reported:
		fixed_reported = true
		print("first fixed delta: ", delta)
