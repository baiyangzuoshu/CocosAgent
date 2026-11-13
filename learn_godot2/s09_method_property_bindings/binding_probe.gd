extends Node

func _ready():
	var target = Node2D.new()
	print("has set_pos: ", target.has_method("set_pos"))
	target.callv("set_pos", [Vector2(12, 24)])
	print("callv set_pos -> transform/pos: ", target.get("transform/pos"))
	target.set("transform/pos", Vector2(30, 40))
	print("set transform/pos -> get_pos: ", target.callv("get_pos", []))
	target.free()
