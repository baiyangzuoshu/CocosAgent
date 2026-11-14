from inspect import signature

class Tool:
    def __init__(self, function, name):
        self.function = function
        self.name = name
        self.required = set(signature(function).parameters)

    def invoke(self, arguments):
        missing = self.required - arguments.keys()
        if missing:
            raise ValueError(f"missing arguments: {sorted(missing)}")
        return self.function(**arguments)

def weather(city: str) -> str:
    return f"sunny in {city}"

tool = Tool(weather, name="weather")
print("tool:", tool.name)
print("result:", tool.invoke({"city": "Tokyo"}))
