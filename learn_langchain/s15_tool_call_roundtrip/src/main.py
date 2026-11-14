ai_message = {
    "role": "assistant",
    "tool_calls": [
        {"id": "call-1", "name": "get_weather", "args": {"city": "Tokyo"}}
    ],
}
tools = {"get_weather": lambda city: f"sunny in {city}"}

call = ai_message["tool_calls"][0]
result = tools[call["name"]](**call["args"])
tool_message = {
    "role": "tool",
    "tool_call_id": call["id"],
    "content": result,
}
print("AI requested:", call["name"])
print(f"ToolMessage: {tool_message['content']} (call_id={tool_message['tool_call_id']})")
