from collections.abc import Callable


class Aggregate:
    def __init__(self, initial: int, combine: Callable[[int, int], int]) -> None:
        self.value = initial
        self.combine = combine

    def update(self, writes: list[int]) -> None:
        for item in writes:
            self.value = self.combine(self.value, item)


total = Aggregate(0, lambda left, right: left + right)
total.update([2, 3, 5])
print("aggregate:", total.value)
