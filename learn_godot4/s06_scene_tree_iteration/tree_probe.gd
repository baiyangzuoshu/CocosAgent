extends Node

var elapsed = 0.0
var idle_reported = false
var physics_reported = false
var quit_requested = false

func _ready() -> void:
	# Run the lesson's miniature source replica before probing the real engine API.
	var replay = load("res://src/source_replay.gd").new()
	replay.run()
	set_process(true)
	set_physics_process(true)
	print("S06 SceneTree probe ready")

func _process(delta: float) -> void:
	elapsed += delta
	if not idle_reported:
		idle_reported = true
		print("first process delta: ", delta)
	if elapsed >= 2.0 and not quit_requested:
		quit_requested = true
		print("S06 calling SceneTree.quit()")
		get_tree().quit()

func _physics_process(delta: float) -> void:
	if not physics_reported:
		physics_reported = true
		print("first physics delta: ", delta)
