from typing import Any, Callable

State = dict[str, Any]
Reducer = Callable[[Any, Any], Any]


def apply_step(state: State, task_updates: list[State], reducers: dict[str, Reducer]) -> State:
    result = dict(state)
    writes: dict[str, list[Any]] = {}
    for update in task_updates:
        for key, value in update.items():
            writes.setdefault(key, []).append(value)

    for key, values in writes.items():
        if key in reducers:
            for value in values:
                result[key] = reducers[key](result[key], value)
        elif len(values) == 1:
            result[key] = values[0]
        else:
            raise ValueError(f"multiple writes to {key!r} need a reducer")
    return result


initial = {"count": 0, "items": []}
reducers = {"items": lambda old, new: old + new}
after_step_1 = apply_step(initial, [{"count": 1, "items": ["a"]}, {"items": ["b"]}], reducers)
result = apply_step(after_step_1, [{"count": 2}], reducers)

print("merged:", result)
