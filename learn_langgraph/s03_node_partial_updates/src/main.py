from typing import Any

State = dict[str, Any]


def increment(state: State) -> dict[str, int]:
    return {"count": state["count"] + 1}


before = {"count": 4, "label": "draft"}
update = increment(before)
after = {**before, **update}

print("input :", before)
print("update:", update)
print("state :", after)
