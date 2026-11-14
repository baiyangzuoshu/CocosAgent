extends Node

func _on_course_signal(value, bound_value):
	print("S11 receiver got emitted value: ", value, ", bound value: ", bound_value)
	get_tree().quit()
