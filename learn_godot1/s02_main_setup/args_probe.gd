extends Node

func _ready():
	var args = OS.get_cmdline_args()
	print("S02 engine arguments:")
	for arg in args:
		print(arg)
