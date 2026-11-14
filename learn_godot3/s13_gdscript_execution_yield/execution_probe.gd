extends Node

func _ready():
	var script_resource = load("res://payload.gd")
	var target = script_resource.new()
	target.set("score", 21)
	var score = target.get("score")
	print("S13 ScriptInstance get: ", score)
	print("S13 dynamic call: ", target.call("twice", score))
	target = null
	_run_yield_probe()

func _run_yield_probe():
	print("S13 before yield")
	yield(get_tree(), "idle_frame")
	print("S13 after idle_frame yield")
	get_tree().quit()
