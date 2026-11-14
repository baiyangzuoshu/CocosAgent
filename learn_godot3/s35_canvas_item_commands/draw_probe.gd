extends Node2D
var color_a = Color(1, 0.25, 0.2)
var color_b = Color(0.2, 0.5, 1)

func _ready():
	update()

func _draw():
	draw_rect(Rect2(Vector2(20, 20), Vector2(120, 72)), color_a, true)
	draw_rect(Rect2(Vector2(70, 55), Vector2(120, 72)), color_b, true)
	print("[draw callback] submitted two overlapping rect commands")
