def research_subgraph(child_state: dict[str, str]) -> dict[str, str]:
    draft = f"资料：{child_state['query']}"
    return {"draft": draft}


def parent_node(parent_state: dict[str, str]) -> dict[str, str]:
    child_input = {"query": parent_state["question"]}
    child_result = research_subgraph(child_input)
    return {"answer": child_result["draft"]}


parent_state = {"question": "channel"}
result = {**parent_state, **parent_node(parent_state)}
print("parent state:", result)
print("child-only key:", "draft" in result)
