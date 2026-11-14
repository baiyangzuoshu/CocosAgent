from collections.abc import Callable
from typing import Any

State = dict[str, Any]
Node = Callable[[State], dict[str, Any]]


class MiniBuilder:
    def __init__(self) -> None:
        self.nodes: dict[str, Node] = {}
        self.edges: list[tuple[str, str]] = []

    def add_node(self, name: str, node: Node) -> None:
        self.nodes[name] = node

    def add_edge(self, source: str, target: str) -> None:
        self.edges.append((source, target))


def clean(state: State) -> dict[str, str]:
    return {"question": state["question"].strip()}


def reply(state: State) -> dict[str, str]:
    return {"answer": f"收到：{state['question']}"}


builder = MiniBuilder()
builder.add_node("clean", clean)
builder.add_node("reply", reply)
builder.add_edge("clean", "reply")

print("registered nodes:", sorted(builder.nodes))
print("registered edges:", builder.edges)
print("node calls during registration: 0")
