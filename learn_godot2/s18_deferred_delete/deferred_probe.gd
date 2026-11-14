extends Node

var frames = 0

func _ready():
	var child = Node.new()
	child.name = "DeferredChild"
	child.set_script(load("res://deferred_child.gd"))
	add_child(child)
	child.call_deferred("_deferred_free")
	set_process(true)
	print("S18 deferred free requested")

func _process(delta):
	frames += 1
	if frames >= 3:
		get_tree().quit()
