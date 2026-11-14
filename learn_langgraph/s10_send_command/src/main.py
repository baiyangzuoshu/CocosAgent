from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class Send:
    node: str
    arg: dict[str, Any]


@dataclass(frozen=True)
class Command:
    update: dict[str, Any]
    goto: str


items = ["a", "b", "c"]
tasks = [Send("score", {"item": item}) for item in items]
decision = Command({"needs_review": True}, "human_review")

print("dynamic tasks:", [(task.node, task.arg["item"]) for task in tasks])
print("command:", decision.update, "goto", decision.goto)
