# 本课 C++ 调用路径的 GDScript 教学复刻，不是 Godot 引擎实现。
extends RefCounted

# Navigation model: version.py → build version fields → native API → script-visible version.
func run():
	print("[replay S00] version source → generated build value → script binding")
	var map = ["main/ : startup and frame loop", "core/ : Object, Variant, OS", "scene/ : Node, SceneTree and resources", "servers/ : rendering and physics", "platform/ : native window/input"]
	for area in map:
		print("[replay S00] ", area)
	print("[replay S00] evidence boundary: directory map is navigation, not a call chain")
