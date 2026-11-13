extends Node

signal score_changed(value: int)

func _ready() -> void:
	var callback: Callable = _on_score_changed
	score_changed.connect(callback)
	score_changed.emit(7)
	print("S10 signal connected: ", score_changed.is_connected(callback))
	var doubled: Callable = _double_score
	print("S10 Callable result: ", doubled.call(7))
	var add_five: Callable = _add.bind(5)
	print("S10 bound Callable result: ", add_five.call(2))

func _on_score_changed(value: int) -> void:
	print("S10 signal received: ", value)

func _double_score(value: int) -> int:
	return value * 2

func _add(left: int, right: int) -> int:
	return left + right
