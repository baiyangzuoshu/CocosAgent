extends Node

func _ready():
	var first = load("res://payload.tscn")
		var second = load("res://payload.tscn")
		print("same cached object: ", first == second)
		print("resource path: ", first.get_path())
		var keep = second
		first = null
		print("remaining reference: ", keep != null)
