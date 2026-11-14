# 本课 C++ 调用路径的 GDScript 教学复刻，不是 Godot 引擎实现。
extends RefCounted

# Small model of setup argument partitioning; the real parser has more options/platform branches.
func run():
	var argv = ["godot", "--path", "lesson-project", "--course-probe"]
	var parsed = _parse_args(argv)
	print("[replay S02] project path: ", parsed["project"])
	print("[replay S02] remaining args: ", parsed["remaining"])
	print("[replay S02] OS::set_cmdline stores the remaining list for the script binding")

func _parse_args(argv):
	var result = {"project": ".", "remaining": []}
	var i = 1
	while i < argv.size():
		var arg = argv[i]
		if arg == "--path" and i + 1 < argv.size():
			result["project"] = argv[i + 1]
			i += 2
		else:
			result["remaining"].append(arg)
			i += 1
	return result
