calls = {"left": 0, "right": 0}
pending: dict[str, dict[str, int]] = {}


def run_left() -> dict[str, int]:
    calls["left"] += 1
    return {"left": 3}


def run_right() -> dict[str, int]:
    calls["right"] += 1
    if calls["right"] == 1:
        raise RuntimeError("temporary failure")
    return {"right": 4}


pending["left"] = run_left()
try:
    pending["right"] = run_right()
except RuntimeError:
    print("first attempt: right failed; pending:", sorted(pending))

if "left" not in pending:
    pending["left"] = run_left()
pending["right"] = run_right()
print("calls:", calls, "committed:", pending)
