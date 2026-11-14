from copy import deepcopy

snapshots: dict[str, dict[str, object]] = {}


def save(thread_id: str, state: dict[str, object]) -> None:
    snapshots[thread_id] = deepcopy(state)


def load(thread_id: str) -> dict[str, object] | None:
    value = snapshots.get(thread_id)
    return deepcopy(value) if value is not None else None


save("user-a", {"turn": 2, "topic": "rendering"})
save("user-b", {"turn": 1, "topic": "physics"})
print("user-a:", load("user-a"))
print("user-b:", load("user-b"))
