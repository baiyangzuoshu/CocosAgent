class ProviderAdapter:
    def to_payload(self, messages):
        return {
            "messages": [
                {"role": role, "content": content}
                for role, content in messages
            ]
        }

    def from_response(self, response):
        return {"role": "assistant", "content": response["text"]}

adapter = ProviderAdapter()
payload = adapter.to_payload([
    ("system", "Be concise."),
    ("user", "Hello"),
])
message = adapter.from_response({"text": "simulated response"})
print("payload roles:", [item["role"] for item in payload["messages"]])
print("AI:", message["content"])
