extends Node

signal score_changed(value: int)

func _ready() -> void:
	# Run the lesson's miniature source replica before probing the real engine API.
	var replay = load("res://src/source_replay.gd").new()
	replay.run()
	var callback: Callable = _on_score_changed
	score_changed.connect(callback)
	var bound_five: Callable = _add.bind(5)
	var bound_nine: Callable = _add.bind(9)
	var first_bound_status = score_changed.connect(bound_five)
	var duplicate_base_status = score_changed.connect(bound_nine)
	score_changed.emit(7)
	print("S10 signal connected: ", score_changed.is_connected(callback))
	print("S10 connect same method with different bind values: ", first_bound_status, ", ", duplicate_base_status, " (second should be ERR_INVALID_PARAMETER)")
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
