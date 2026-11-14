class FakeModel:
    def invoke(self, messages):
        if not any(message["role"] == "tool" for message in messages):
            return {
                "role": "assistant",
                "tool_call": {"name": "weather", "args": {"city": "Tokyo"}},
            }
        return {"role": "assistant", "content": "It is sunny in Tokyo."}

messages = [{"role": "user", "content": "Weather in Tokyo?"}]
model = FakeModel()
tools = {"weather": lambda city: f"It is sunny in {city}."}

while True:
    response = model.invoke(messages)
    if "tool_call" not in response:
        messages.append(response)
        break
    messages.append(response)
    call = response["tool_call"]
    result = tools[call["name"]](**call["args"])
    messages.append({"role": "tool", "name": call["name"], "content": result})

print("assistant:", messages[-1]["content"])
print("messages:", len(messages))
