extends Node

func _ready():
	var root = Node.new()
	root.name = "PackedRoot"
	var child = Node.new()
	child.name = "OwnedChild"
	root.add_child(child)
	child.owner = root
	var packed = PackedScene.new()
	var err = packed.pack(root)
	print("pack error: ", err)
	var copy = packed.instance()
	print("instance root: ", copy.name, " children: ", copy.get_child_count())
