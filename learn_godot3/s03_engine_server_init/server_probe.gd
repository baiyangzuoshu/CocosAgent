extends Node

func _ready():
	print("S03 Node2D registered: ", ClassDB.class_exists("Node2D"))
	print("S03 VisualServer registered: ", ClassDB.class_exists("VisualServer"))
	print("S03 VisualServer INFO_OBJECTS_IN_FRAME: ", VisualServer.get_render_info(VisualServer.INFO_OBJECTS_IN_FRAME))
