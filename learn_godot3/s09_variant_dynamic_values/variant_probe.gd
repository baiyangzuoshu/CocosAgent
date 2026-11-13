extends Node

func _ready():
	var values = [null, true, 42, 3.5, "godot", Vector2(2, 4), {"score": 42}]
	for value in values:
		print("S09 Variant type code: ", typeof(value))
	print("S09 convert String to INT: ", convert("42", TYPE_INT))
	var payload = {"position": Vector2(2, 4), "score": 42}
	var encoded = var2str(payload)
	var restored = str2var(encoded)
	print("S09 serialized: ", encoded)
	print("S09 round trip equal: ", restored == payload)
	var target = Node2D.new()
	target.callv("set_position", [Vector2(11, 23)])
	print("S09 callv position: ", target.position)
	target.free()
