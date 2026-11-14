state_keys = {"question", "normalized", "answer"}
input_keys = {"question"}
output_keys = {"answer"}

incoming = {"question": "  运行时边界  ", "debug": True}
state = {key: incoming[key] for key in input_keys if key in incoming}
state["normalized"] = state["question"].strip()
state["answer"] = f"已处理：{state['normalized']}"
result = {key: state[key] for key in output_keys}

print("internal keys:", sorted(state_keys))
print("input state  :", {key: incoming[key] for key in input_keys})
print("final output :", result)
