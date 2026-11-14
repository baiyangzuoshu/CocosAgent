class FakeModel:
    def invoke(self, prompt):
        return "Hello from fake"

PROVIDERS = {"fake": FakeModel}

def init_chat_model(model_spec):
    provider, _model_name = model_spec.split(":", maxsplit=1)
    return PROVIDERS[provider]()

model = init_chat_model("fake:echo")
print("provider: fake")
print("result:", model.invoke("hello"))
