class Runnable:
    def invoke(self, value):
        raise NotImplementedError

class FunctionRunnable(Runnable):
    def __init__(self, function):
        self.function = function

    def invoke(self, value):
        return self.function(value)

uppercase = FunctionRunnable(str.upper)
print(uppercase.invoke("langchain"))
