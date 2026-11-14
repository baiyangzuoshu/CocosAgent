extends Node

func _ready():
	var loaded = ResourceLoader.load("res://payload.xml")
	print("loaded resource: ", loaded)
	print("has scene: ", loaded != null)
