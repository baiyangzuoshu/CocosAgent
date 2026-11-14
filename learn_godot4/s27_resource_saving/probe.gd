extends Node

func _ready():
	var data = Resource.new()
	data.resource_name = "S27SavedResource"
	var path = "user://s27_saved_resource.tres"
	var err = ResourceSaver.save(data, path)
	print("save error: ", err)
	var loaded = ResourceLoader.load(path)
	print("loaded path: ", loaded.resource_path if loaded != null else "<null>")
