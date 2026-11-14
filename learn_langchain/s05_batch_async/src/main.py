import asyncio
from concurrent.futures import ThreadPoolExecutor

class Runnable:
    def __init__(self, function):
        self.function = function

    def invoke(self, value):
        return self.function(value)

    def batch(self, values):
        with ThreadPoolExecutor() as pool:
            return list(pool.map(self.invoke, values))

    async def abatch(self, values):
        return await asyncio.gather(
            *(asyncio.to_thread(self.invoke, value) for value in values)
        )

async def main():
    double = Runnable(lambda number: number * 2)
    print("batch:", double.batch([1, 2, 3]))
    print("async batch:", await double.abatch([4, 5]))

asyncio.run(main())
