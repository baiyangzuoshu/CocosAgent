class Runnable:
    def __init__(self, function, observed_tags):
        self.function = function
        self.observed_tags = observed_tags

    def invoke(self, value, config=None):
        config = config or {}
        self.observed_tags.extend(config.get("tags", []))
        return self.function(value)

class Sequence:
    def __init__(self, *steps):
        self.steps = steps

    def invoke(self, value, config=None):
        for step in self.steps:
            value = step.invoke(value, config=config)
        return value

seen = []
chain = Sequence(Runnable(str.upper, seen), Runnable(lambda text: text, seen))
result = chain.invoke("core", config={"tags": ["course", "s04"]})
print("result:", result)
print("child tags:", seen[:2])
