class Middleware:
    def __init__(self):
        self.events = []

    def wrap_model_call(self, request, next_call):
        self.events.append("before")
        response = next_call(request)
        self.events.append("after")
        return response

def model(request):
    return request.upper()

middleware = Middleware()
result = middleware.wrap_model_call("hello", model)
print("result:", result)
print("middleware:", middleware.events)
