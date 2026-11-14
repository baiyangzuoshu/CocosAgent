from collections.abc import Callable
from typing import Any

START = "__start__"
END = "__end__"

State = dict[str, Any]
Node = Callable[[State], dict[str, Any]]


class MiniStateGraph:
    """A small linear graph builder for the first lesson."""

    def __init__(self) -> None:
        self.nodes: dict[str, Node] = {}
        self.edges: dict[str, str] = {}

    def add_node(self, name: str, node: Node) -> None:
        if not name or name in (START, END):
            raise ValueError(f"Invalid node name: {name!r}")
        if name in self.nodes:
            raise ValueError(f"Node already exists: {name}")
        self.nodes[name] = node

    def add_edge(self, source: str, target: str) -> None:
        if source == END:
            raise ValueError("END cannot be a source")
        if target == START:
            raise ValueError("START cannot be a target")
        if source in self.edges:
            raise ValueError(
                f"This lesson supports one outgoing edge per node: {source}"
            )
        self.edges[source] = target

    def compile(self) -> "MiniCompiledGraph":
        if START not in self.edges:
            raise ValueError("Graph needs an edge from START")

        for source, target in self.edges.items():
            if source != START and source not in self.nodes:
                raise ValueError(f"Edge starts at an unknown node: {source}")
            if target != END and target not in self.nodes:
                raise ValueError(f"Edge points to an unknown node: {target}")

        visited: set[str] = set()
        current = self.edges[START]
        while current != END:
            if current not in self.nodes:
                raise ValueError(f"Edge points to an unknown node: {current}")
            if current in visited:
                raise ValueError("This lesson supports acyclic graphs only")
            if current not in self.edges:
                raise ValueError(f"Node has no outgoing edge: {current}")
            visited.add(current)
            current = self.edges[current]

        unreachable = set(self.nodes) - visited
        if unreachable:
            names = ", ".join(sorted(unreachable))
            raise ValueError(f"Unreachable node(s): {names}")

        compiled = MiniCompiledGraph(
            nodes=dict(self.nodes),
            edges=dict(self.edges),
        )
        print(
            f"[compile] entry={self.edges[START]}, "
            f"nodes={len(compiled.nodes)}"
        )
        return compiled


class MiniCompiledGraph:
    """An executable copy of a validated linear graph."""

    def __init__(self, nodes: dict[str, Node], edges: dict[str, str]) -> None:
        self.nodes = nodes
        self.edges = edges

    def invoke(self, input_state: State) -> State:
        state = dict(input_state)
        current = self.edges[START]

        while current != END:
            updates = self.nodes[current](state)
            if not isinstance(updates, dict):
                raise TypeError(f"Node {current!r} must return a dictionary")
            print(f"[invoke] {current} -> {updates}")
            state.update(updates)
            current = self.edges[current]

        return state


def clean_question(state: State) -> dict[str, Any]:
    return {"question": state["question"].strip()}


def make_reply(state: State) -> dict[str, Any]:
    return {"answer": f"已收到：{state['question']}"}


def main() -> None:
    builder = MiniStateGraph()
    builder.add_node("clean_question", clean_question)
    builder.add_node("make_reply", make_reply)
    builder.add_edge(START, "clean_question")
    builder.add_edge("clean_question", "make_reply")
    builder.add_edge("make_reply", END)

    graph = builder.compile()
    result = graph.invoke({"question": "  LangGraph 如何运行？  "})
    print(f"[result] {result}")


if __name__ == "__main__":
    main()
