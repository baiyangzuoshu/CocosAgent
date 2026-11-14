extends Node

const BASE: int = 6
var total: int = BASE

func _ready() -> void:
	total = _combine(3, 4)
	print("S12 parsed script result: ", total)
	get_tree().quit()

func _combine(left: int, right: int) -> int:
	return left + right
