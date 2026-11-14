extends Node

func _ready():
	var first = load("res://payload.tscn")
		var second = load("res://payload.tscn")
		print("same object on same path: ", first == second)
		print("cached path: ", first.get_path())
