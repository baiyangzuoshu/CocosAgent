extends Node

const SNAPSHOT_MAJOR = "2"
const SNAPSHOT_MINOR = "1"
const SNAPSHOT_PATCH = "7"
const SNAPSHOT_STATUS = "rc"

func _ready():
	var version_info = OS.get_engine_version()
	var matches_snapshot = version_info["major"] == SNAPSHOT_MAJOR
	matches_snapshot = matches_snapshot and version_info["minor"] == SNAPSHOT_MINOR
	matches_snapshot = matches_snapshot and version_info["patch"] == SNAPSHOT_PATCH
	matches_snapshot = matches_snapshot and version_info["status"] == SNAPSHOT_STATUS

	print("Source snapshot: Godot 2.1.7-rc")
	print("Runtime engine: " + version_info["string"])
	print("Version fields match: " + str(matches_snapshot))
