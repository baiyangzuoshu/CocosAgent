extends Node

func _ready():
	print("S03 VisualServer INFO_OBJECTS_IN_FRAME:")
	print(VisualServer.get_render_info(VisualServer.INFO_OBJECTS_IN_FRAME))
