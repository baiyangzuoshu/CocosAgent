START = "__start__"
END = "__end__"


def validate(nodes: set[str], edges: list[tuple[str, str]]) -> None:
    if not any(source == START for source, _ in edges):
        raise ValueError("missing START edge")
    for source, target in edges:
        if source != START and source not in nodes:
            raise ValueError(f"unknown source: {source}")
        if target != END and target not in nodes:
            raise ValueError(f"unknown target: {target}")


nodes = {"load", "save"}
valid_edges = [(START, "load"), ("load", "save"), ("save", END)]
bad_edges = [(START, "load"), ("load", "missing")]

validate(nodes, valid_edges)
print("valid graph: accepted")
try:
    validate(nodes, bad_edges)
except ValueError as error:
    print("invalid graph:", error)
