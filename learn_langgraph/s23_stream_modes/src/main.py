updates = [
    ("clean", {"question": "stream"}),
    ("reply", {"answer": "done"}),
]
state = {}

for node, update in updates:
    state.update(update)
    print("updates:", (node, update))
    print("values :", dict(state))
    print("debug  :", {"event": "task_end", "node": node})
