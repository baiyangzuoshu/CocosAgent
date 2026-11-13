extends Node

func _ready() -> void:
	print("S03 Node2D registered: ", ClassDB.class_exists("Node2D"))
	print("S03 RenderingServer registered: ", ClassDB.class_exists("RenderingServer"))
	print("S03 RenderingServer RENDERING_INFO_TOTAL_OBJECTS_IN_FRAME: ", RenderingServer.get_rendering_info(RenderingServer.RENDERING_INFO_TOTAL_OBJECTS_IN_FRAME))
