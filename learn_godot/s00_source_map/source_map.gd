extends Node

const SNAPSHOT_MAJOR := 4
const SNAPSHOT_MINOR := 8
const SNAPSHOT_PATCH := 0
const SNAPSHOT_STATUS := "beta"

func _ready() -> void:
	var version_info: Dictionary = Engine.get_version_info()
	var runtime_version := "%s.%s.%s %s" % [
		str(version_info.get("major", "?")),
		str(version_info.get("minor", "?")),
		str(version_info.get("patch", "?")),
		str(version_info.get("status", "unknown")),
	]

	print("源码快照：Godot 4.8.0 beta")
	print("本机运行时：", version_info.get("string", runtime_version))
	print("运行时版本字段：", runtime_version)
	print("版本字段匹配：", _matches_snapshot(version_info))

func _matches_snapshot(version_info: Dictionary) -> bool:
	return (
		int(version_info.get("major", -1)) == SNAPSHOT_MAJOR
		and int(version_info.get("minor", -1)) == SNAPSHOT_MINOR
		and int(version_info.get("patch", -1)) == SNAPSHOT_PATCH
		and str(version_info.get("status", "")) == SNAPSHOT_STATUS
	)
