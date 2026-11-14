extends Node

func _ready():
	var script_resource = load("res://payload.gd")
	var target = script_resource.new()
	target.set("score", 21)
	var score = target.get("score")
	print("S13 ScriptInstance get: ", score)
	print("S13 dynamic call: ", target.call("twice", score))
	target = null
	get_tree().quit()
