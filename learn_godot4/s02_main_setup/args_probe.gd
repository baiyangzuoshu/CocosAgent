extends Node

func _ready() -> void:
	print("S02 engine arguments: ", OS.get_cmdline_args())
	print("S02 user arguments: ", OS.get_cmdline_user_args())
