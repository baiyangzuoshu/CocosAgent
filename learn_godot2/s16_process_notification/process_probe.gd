extends Node

var idle_count = 0
var fixed_count = 0

func _ready():
	set_process(true)
	set_fixed_process(true)

func _process(delta):
	if idle_count < 3:
		print("S16 idle delta: ", delta)
	idle_count += 1
	if idle_count >= 3 and fixed_count >= 1:
		get_tree().quit()

func _fixed_process(delta):
	if fixed_count < 3:
		print("S16 fixed delta: ", delta)
	fixed_count += 1
