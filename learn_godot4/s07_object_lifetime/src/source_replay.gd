# S07 Godot 4.7: ObjectID slots/validators track objects; RefCounted controls ownership.
extends RefCounted

func run():
	var slots = {}
	var next_slot = 17
	var object_id = _allocate(slots, next_slot, "Object", false)
	var resource_id = _allocate(slots, next_slot + 1, "RefCounted", true)
	print("[replay S07] ObjectID=", object_id, " valid=", _resolve(slots, object_id) != null)
	_free_object(slots, object_id)
	print("[replay S07] Object.free invalidates slot=", _resolve(slots, object_id) == null)
	_ref(slots, resource_id)
	_unref(slots, resource_id)
	print("[replay S07] RefCounted with one owner still resolves=", _resolve(slots, resource_id) != null)
	_unref(slots, resource_id)
	print("[replay S07] zero owners releases slot=", _resolve(slots, resource_id) == null)

func _allocate(slots, slot, class_label, ref_counted):
	var validator = slot * 37
	slots[slot] = {"validator": validator, "class": class_label, "ref_counted": ref_counted, "refs": 1 if ref_counted else 0}
	return {"slot": slot, "validator": validator}

func _resolve(slots, object_id):
	var slot = object_id["slot"]
	if not slots.has(slot) or slots[slot]["validator"] != object_id["validator"]:
		return null
	return slots[slot]

func _free_object(slots, object_id):
	var slot = object_id["slot"]
	if _resolve(slots, object_id) != null:
		slots.erase(slot)

func _ref(slots, object_id):
	slots[object_id["slot"]]["refs"] += 1

func _unref(slots, object_id):
	var slot = object_id["slot"]
	slots[slot]["refs"] -= 1
	if slots[slot]["refs"] == 0:
		slots.erase(slot)
