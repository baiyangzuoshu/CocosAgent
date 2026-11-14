extends Node

func _deferred_free():
	print("S18 deferred method invoked")
	queue_free()

func _exit_tree():
	print("S18 child exit_tree")
