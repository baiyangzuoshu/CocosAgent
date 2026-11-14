from typing import TypedDict, get_type_hints


class QueryState(TypedDict, total=False):
    question: str
    answer: str


fields = get_type_hints(QueryState)
print("state keys:", list(fields))
print("field types:", {name: kind.__name__ for name, kind in fields.items()})
