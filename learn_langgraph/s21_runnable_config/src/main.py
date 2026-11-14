from copy import deepcopy

defaults = {
    "tags": ["course"],
    "metadata": {"lesson": 21},
    "recursion_limit": 25,
    "configurable": {},
}
call_config = {
    "tags": ["demo"],
    "recursion_limit": 8,
    "configurable": {"thread_id": "case-7"},
}

resolved = deepcopy(defaults)
resolved["tags"] = [*defaults["tags"], *call_config["tags"]]
resolved["recursion_limit"] = call_config["recursion_limit"]
resolved["configurable"].update(call_config["configurable"])

print("resolved config:", resolved)
print("graph state contains thread_id:", "thread_id" in {})
