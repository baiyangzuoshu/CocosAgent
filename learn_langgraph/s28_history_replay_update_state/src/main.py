history = [
    {"id": "c1", "parent": None, "state": {"count": 1}},
    {"id": "c2", "parent": "c1", "state": {"count": 2}},
]
base = next(snapshot for snapshot in history if snapshot["id"] == "c1")


def increment(state: dict[str, int]) -> dict[str, int]:
    return {"count": state["count"] + 1}


replayed = {**base["state"], **increment(base["state"])}
edited = {**base["state"], "approved": True}
branch = {"id": "c3", "parent": base["id"], "state": edited}
history.append(branch)

print("history ids:", [item["id"] for item in history])
print("replay from c1:", replayed)
print("new branch :", branch)
