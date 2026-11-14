from dataclasses import dataclass

@dataclass
class Message:
    role: str
    content: str | list[dict[str, str]]

human = Message("human", [
    {"type": "text", "text": "Describe this image."},
    {"type": "image", "url": "https://example.test/cat.png"},
])
tool_calls = [{"name": "get_weather", "args": {"city": "Tokyo"}}]
print("human:", human.content[0]["text"])
print("image block:", human.content[1]["url"])
print("AI tool calls:", [call["name"] for call in tool_calls])
