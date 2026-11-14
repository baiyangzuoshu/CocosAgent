extends Node

const BASE = 6
var total = BASE

func _ready():
	total = _combine(3, 4)
	print("S12 parsed script result: ", total)
	get_tree().quit()

func _combine(left, right):
	return left + right
