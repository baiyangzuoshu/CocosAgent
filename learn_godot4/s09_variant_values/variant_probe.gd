extends Node

func _ready() -> void:
	# Run the lesson's miniature source replica before probing the real engine API.
	var replay = load("res://src/source_replay.gd").new()
	replay.run()
	var values: Array = [null, true, 42, 3.5, "godot", Vector2i(2, 4), {"score": 42}]
	for value in values:
		print("S09 Variant type: ", type_string(typeof(value)))
	print("S09 type_convert String to INT: ", type_convert("42", TYPE_INT))
	var payload: Dictionary = {"position": Vector2i(2, 4), "score": 42}
	var encoded := var_to_str(payload)
	var restored: Variant = str_to_var(encoded)
	print("S09 serialized: ", encoded)
	print("S09 round trip equal: ", restored == payload)
