extends Node

const PATH = "res://payload.tscn"
const UID_PROBE_PATH = "user://s23_uid_probe.tres"

func _ready():
	var id = ResourceUID.create_id()
	ResourceUID.add_id(id, UID_PROBE_PATH)
	var uid_text = ResourceUID.id_to_text(id)
	print("temporary UID: ", uid_text)
	print("path_to_uid: ", ResourceUID.path_to_uid(UID_PROBE_PATH))
	print("UID round trip: ", ResourceUID.uid_to_path(uid_text))
	ResourceUID.remove_id(id)
	var first = ResourceLoader.load(PATH)
	var second = ResourceLoader.load(PATH)
	print("same cached resource: ", first == second)
