class Runnable:
    def __init__(self, function):
        self.function = function

    def invoke(self, value):
        return self.function(value)

    def __or__(self, other):
        return Sequence(self, other)

class Sequence:
    def __init__(self, *steps):
        self.steps = steps

    def invoke(self, value):
        for step in self.steps:
            value = step.invoke(value)
        return value

    def __or__(self, other):
        return Sequence(*self.steps, other)

chain = Runnable(str.upper) | Runnable(lambda text: text + "!")
print(chain.invoke("core"))
