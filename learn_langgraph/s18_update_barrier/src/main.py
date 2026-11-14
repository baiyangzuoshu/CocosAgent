state = {"count": 0}
seen_by = {}
writes = {}

for name, amount in (("left", 1), ("right", 10)):
    seen_by[name] = state["count"]
    writes[name] = {name: state["count"] + amount}

next_state = dict(state)
for update in writes.values():
    next_state.update(update)

print("seen:", seen_by)
print("writes:", writes)
print("committed:", next_state)
