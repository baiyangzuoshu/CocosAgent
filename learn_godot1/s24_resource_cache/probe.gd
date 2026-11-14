extends Node

func _ready():
	var a = load("res://payload.xml")
	var b = load("res://payload.xml")
	print("same cached object: ", a == b)
