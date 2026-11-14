extends Node

func _ready():
	var parent = Node.new()
	parent.name = "Parent"
	var child = Node.new()
	child.name = "Child"
	add_child(parent)
	parent.add_child(child)
	child.owner = self
	print("S14 path: ", get_node("Parent/Child").get_path())
	print("S14 parent: ", child.get_parent().name)
	print("S14 owner: ", child.owner.name)
	get_tree().quit()
