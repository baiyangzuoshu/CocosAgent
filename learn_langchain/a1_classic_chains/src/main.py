class LLMChain:
    def __init__(self, prompt, model):
        self.prompt = prompt
        self.model = model

    def invoke(self, values):
        return self.model(self.prompt.format(**values))

class SequentialChain:
    def __init__(self, *chains):
        self.chains = chains

    def invoke(self, values):
        result = values
        for chain in self.chains:
            result = {"text": chain.invoke(result)}
        return result

chain = SequentialChain(
    LLMChain("Say {text}", lambda prompt: prompt.split(" ", 1)[1]),
    LLMChain("{text}!", str.upper),
)
print("result:", chain.invoke({"text": "hello"})["text"])
