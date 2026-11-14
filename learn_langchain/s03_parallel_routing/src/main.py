class Parallel:
    def __init__(self, **steps):
        self.steps = steps

    def invoke(self, value):
        return {name: step(value) for name, step in self.steps.items()}

class Branch:
    def __init__(self, cases, default):
        self.cases = cases
        self.default = default

    def invoke(self, value):
        for condition, step in self.cases:
            if condition(value):
                return step(value)
        return self.default(value)

results = Parallel(upper=str.upper, length=len).invoke("core")
route = Branch([(lambda text: len(text) < 5, lambda _: "short")],
               lambda _: "long").invoke("core")
print("parallel:", results)
print("route:", route)
