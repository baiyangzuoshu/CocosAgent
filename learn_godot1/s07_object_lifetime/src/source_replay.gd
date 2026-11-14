# 本课 C++ 调用路径的 GDScript 教学复刻，不是 Godot 引擎实现。
extends Reference

# Contrast explicit Object destruction with Reference's last-owner release.
func run():
	var manual_alive = true
	print("[replay S07] Object created; manual free required")
	manual_alive = false
	print("[replay S07] Object.free → alive=", manual_alive)
	var refs = 1
	refs = _reference(refs)
	print("[replay S07] second script owner → refcount model=", refs)
	refs = _unreference(refs)
	print("[replay S07] first owner released → still alive, refcount=", refs)
	refs = _unreference(refs)
	print("[replay S07] final owner released → destroy at zero, refcount=", refs)

func _reference(count):
	return count + 1

func _unreference(count):
	return count - 1
