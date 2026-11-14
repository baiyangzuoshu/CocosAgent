extends Node

func _enter_tree():
	print("S15 root enter")

func _ready():
	print("S15 root ready; attach child")
	var child = Node.new()
	child.name = "DynamicChild"
	child.set_script(load("res://child_probe.gd"))
	add_child(child)
	print("S15 remove child")
	remove_child(child)
	get_tree().quit()

func _exit_tree():
	print("S15 root exit")
