extends Node

signal course_signal(value)

func _ready():
	var receiver = Node.new()
	receiver.name = "Receiver"
	receiver.set_script(load("res://receiver_probe.gd"))
	add_child(receiver)
	connect("course_signal", receiver, "_on_course_signal", [99])
	print("S11 emit starts")
	emit_signal("course_signal", 7)
