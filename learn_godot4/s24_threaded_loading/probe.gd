extends Node

const PATH = "res://payload.tscn"
var requested = false
var finished = false

func _ready():
	var err = ResourceLoader.load_threaded_request(PATH)
	print("request error: ", err)
	requested = err == OK
	set_process(true)

func _process(_delta):
	if not requested or finished:
		return
	var progress = []
	var status = ResourceLoader.load_threaded_get_status(PATH, progress)
	print("thread status: ", status, " progress: ", progress)
	if status == ResourceLoader.THREAD_LOAD_LOADED:
		finished = true
		print("result: ", ResourceLoader.load_threaded_get(PATH))
	elif status == ResourceLoader.THREAD_LOAD_FAILED or status == ResourceLoader.THREAD_LOAD_INVALID_RESOURCE:
		finished = true
		print("threaded load did not complete successfully")
