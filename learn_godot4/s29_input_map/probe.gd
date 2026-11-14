extends Node

func _ready():
	if not InputMap.has_action("s29_confirm"):
		InputMap.add_action("s29_confirm")
	for event in InputMap.action_get_events("ui_accept"):
		InputMap.action_add_event("s29_confirm", event)
	print("copied ui_accept bindings: ", InputMap.action_get_events("ui_accept").size())
	set_process_input(true)

func _input(event):
	print("matches s29_confirm: ", InputMap.event_is_action(event, "s29_confirm", false))
