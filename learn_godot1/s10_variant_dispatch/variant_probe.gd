extends Node

func _add_dynamic_values(left, right):
	return left + right

func _ready():
	# Run the lesson's miniature source replica before probing the real engine API.
	var replay = load("res://src/source_replay.gd").new()
	replay.run()
	var left = 7
	var right = 2.5
	print("S10 dynamic sum: ", _add_dynamic_values(left, right))
	print("S10 typeof(left): ", typeof(left))
	print("S10 convert String to INT: ", convert("42", TYPE_INT))
	var payload = {"position": Vector2(2, 4), "score": 42}
	var encoded = var2str(payload)
	var restored = str2var(encoded)
	print("S10 serialized: ", encoded)
	print("S10 round trip: ", restored)
