extends Node

const SNAPSHOT_MAJOR = 3
const SNAPSHOT_MINOR = 6
const SNAPSHOT_PATCH = 4
const SNAPSHOT_STATUS = "rc"

func _ready():
	# Run the lesson's miniature source replica before probing the real engine API.
	var replay = load("res://src/source_replay.gd").new()
	replay.run()
	var version_info = Engine.get_version_info()
	var runtime_version = "%s.%s.%s %s" % [
		str(version_info.get("major", "?")),
		str(version_info.get("minor", "?")),
		str(version_info.get("patch", "?")),
		str(version_info.get("status", "unknown")),
	]
	var matches_snapshot = (
		int(version_info.get("major", -1)) == SNAPSHOT_MAJOR
		and int(version_info.get("minor", -1)) == SNAPSHOT_MINOR
		and int(version_info.get("patch", -1)) == SNAPSHOT_PATCH
		and str(version_info.get("status", "")) == SNAPSHOT_STATUS
	)

	print("Source snapshot: Godot 3.6.4-rc")
	print("Runtime engine: " + str(version_info.get("string", runtime_version)))
	print("Runtime version fields: " + runtime_version)
	print("Version fields match: " + str(matches_snapshot))
