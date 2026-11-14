class Topic:
    def __init__(self, accumulate: bool) -> None:
        self.accumulate = accumulate
        self.values: list[str] = []

    def update(self, values: list[str]) -> None:
        if not self.accumulate:
            self.values = []
        self.values.extend(values)


per_step = Topic(accumulate=False)
history = Topic(accumulate=True)
for batch in (["a", "b"], ["c"]):
    per_step.update(batch)
    history.update(batch)
    print("batch:", batch, "per_step:", per_step.values, "history:", history.values)
