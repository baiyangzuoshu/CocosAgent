extends Node

var idle_count := 0
var physics_count := 0

func _ready() -> void:
	process_priority = -10
	set_process(true)
	set_physics_process(true)

func _process(delta: float) -> void:
	if idle_count < 3:
		print("S16 process delta: ", delta)
	idle_count += 1
	if idle_count >= 3 and physics_count >= 1:
		get_tree().quit()

func _physics_process(delta: float) -> void:
	if physics_count < 3:
		print("S16 physics delta: ", delta)
	physics_count += 1
