class BaseChatModel:
    def invoke(self, prompt):
        self.events = ["start"]
        message = self.generate(prompt)
        self.events.append("end")
        return message

    def generate(self, prompt):
        raise NotImplementedError

class FakeChatModel(BaseChatModel):
    def generate(self, prompt):
        self.events.append("generate")
        return "Echo: " + prompt

model = FakeChatModel()
answer = model.invoke("hello")
print("events:", model.events)
print("AI:", answer)
