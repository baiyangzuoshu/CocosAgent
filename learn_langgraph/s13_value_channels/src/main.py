class LastValue:
    def __init__(self) -> None:
        self.value = None

    def update(self, values: list[object]) -> None:
        if len(values) > 1:
            raise ValueError("one value per step")
        if values:
            self.value = values[0]


class EphemeralValue(LastValue):
    def update(self, values: list[object]) -> None:
        if values:
            self.value = values[-1]
        else:
            self.value = None


last = LastValue()
temporary = EphemeralValue()
last.update(["saved"])
temporary.update(["event"])
print("step 1:", last.value, temporary.value)
last.update([])
temporary.update([])
print("step 2:", last.value, temporary.value)
