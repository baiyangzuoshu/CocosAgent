extends Node

var elapsed = 0.0
var process_count = 0
var physics_count = 0

func _ready():
	# Run the lesson's miniature source replica before probing the real engine API.
	var replay = load("res://src/source_replay.gd").new()
	replay.run()
	set_process(true)
	set_physics_process(true)

func _process(delta):
	elapsed += delta
	process_count += 1
	if elapsed >= 1.0:
		print("S05 sample ended")
		print("process callbacks: ", process_count)
		print("physics callbacks: ", physics_count)
		get_tree().quit()

func _physics_process(delta):
	physics_count += 1
