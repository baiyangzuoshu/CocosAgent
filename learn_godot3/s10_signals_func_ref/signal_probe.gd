extends Node

signal score_changed(value)

func _ready():
	connect("score_changed", self, "_on_score_changed")
	emit_signal("score_changed", 7)
	var callback = funcref(self, "_double_score")
	print("S10 FuncRef valid: ", callback.is_valid())
	print("S10 FuncRef result: ", callback.call_func(7))

func _on_score_changed(value):
	print("S10 signal received: ", value)

func _double_score(value):
	return value * 2
