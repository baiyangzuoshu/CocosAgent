class FakeModel:
    def stream(self, _prompt):
        yield "Lang"
        yield "Chain"

class UppercaseTransform:
    def transform(self, chunks):
        for chunk in chunks:
            yield chunk.upper()

chunks = list(UppercaseTransform().transform(FakeModel().stream("say hello")))
print("chunks:", chunks)
print("joined:", "".join(chunks))
