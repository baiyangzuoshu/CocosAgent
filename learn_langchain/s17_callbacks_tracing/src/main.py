class Tracer:
    def __init__(self):
        self.events = []

    def start(self, name, parent=None):
        self.events.append(f"{name} start" + (f" parent={parent}" if parent else ""))
        return name

    def end(self, name):
        self.events.append(f"{name} end")

tracer = Tracer()
chain_id = tracer.start("chain")
model_id = tracer.start("model", parent=chain_id)
tracer.end(model_id)
tracer.end(chain_id)
print("\n".join(tracer.events))
