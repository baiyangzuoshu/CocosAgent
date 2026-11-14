from dataclasses import dataclass


@dataclass(frozen=True)
class InterruptRequest:
    prompt: str


def review(
    state: dict[str, object],
    side_effects: list[str],
    resume_value: bool | None = None,
) -> InterruptRequest | dict[str, object]:
    side_effects.append("prepared")
    if resume_value is None:
        return InterruptRequest(f"approve {state['item']}?")
    return {**state, "approved": resume_value, "status": "continue"}


state = {"item": "refund-42"}
side_effects: list[str] = []
pause = review(state, side_effects)
assert isinstance(pause, InterruptRequest)
saved = {"state": dict(state), "interrupt": pause.prompt}
print("paused:", saved)

resume_value = True
resumed = review(state, side_effects, resume_value)
assert isinstance(resumed, dict)
print("resumed:", resumed)
print("pre-interrupt executions:", len(side_effects))
