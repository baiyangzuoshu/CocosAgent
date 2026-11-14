extends Node

var elapsed = 0.0
var idle_count = 0
var fixed_count = 0

func _ready():
	# Run the lesson's miniature source replica before probing the real engine API.
	var replay = load("res://src/source_replay.gd").new()
	replay.run()
	set_process(true)
	set_fixed_process(true)

func _process(delta):
	elapsed += delta
	idle_count += 1
	if elapsed >= 1.0:
		print("S05 sample ended")
		print("idle callbacks: ", idle_count)
		print("fixed callbacks: ", fixed_count)
		get_tree().quit()

func _fixed_process(delta):
	fixed_count += 1
