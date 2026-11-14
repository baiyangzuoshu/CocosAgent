def choose_route(state: dict[str, object]) -> str:
    return "manual" if state["amount"] > 100 else "automatic"


path_map = {"manual": "human_review", "automatic": "approve"}
state = {"amount": 150}
route = choose_route(state)
next_node = path_map[route]

print("route label:", route)
print("next node  :", next_node)
