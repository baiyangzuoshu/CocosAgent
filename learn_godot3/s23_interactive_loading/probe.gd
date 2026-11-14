extends Node

var loader = null
var finished = false

func _ready():
	set_process(true)
	loader = ResourceLoader.load_interactive("res://payload.tscn")
	if loader == null:
		print("load_interactive returned null")

func _process(_delta):
	if loader == null or finished:
		return
	var err = loader.poll()
	if err == ERR_FILE_EOF:
		finished = true
		print("loaded resource: ", loader.get_resource())
	elif err != OK:
		finished = true
		print("load failed: ", err)
	else:
		print("stage ", loader.get_stage(), "/", loader.get_stage_count())
