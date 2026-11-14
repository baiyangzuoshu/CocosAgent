import asyncio
from typing import Any

State = dict[str, Any]


def reply(state: State) -> dict[str, str]:
    return {"answer": f"收到：{state['question']}"}


def invoke(state: State) -> State:
    return {**state, **reply(state)}


async def ainvoke(state: State) -> State:
    await asyncio.sleep(0)
    return {**state, **reply(state)}


async def main() -> None:
    initial = {"question": "图运行时"}
    print("invoke :", invoke(initial))
    print("ainvoke:", await ainvoke(initial))


asyncio.run(main())
