# 本课 C++ 调用路径的 GDScript 教学复刻，不是 Godot 引擎实现。
extends Reference

# A teaching model of RefCounted ownership; actual refcounts stay inside the engine.
func run():
	var owners = 1
	print("[replay S07] construct Resource/Reference with owners=", owners)
	owners = _reference(owners)
	print("[replay S07] copy Ref handle → owners=", owners)
	owners = _unreference(owners)
	print("[replay S07] clear one handle → owners=", owners, " object survives")
	owners = _unreference(owners)
	if owners == 0:
		print("[replay S07] unreference reaches zero → destructor path")

func _reference(count):
	return count + 1

func _unreference(count):
	return count - 1
