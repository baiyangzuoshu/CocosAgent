extends Node

func _ready():
	var first = load("res://payload.xml")
		var second = load("res://payload.xml")
		print("same object on same path: ", first == second)
		print("cached path: ", first.get_path())
