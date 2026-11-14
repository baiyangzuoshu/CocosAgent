from dataclasses import dataclass
from types import MappingProxyType
from typing import Any


@dataclass(frozen=True)
class Runtime:
    context: Any


def greet(state: dict[str, str], runtime: Runtime) -> dict[str, str]:
    language = runtime.context["language"]
    return {"reply": f"{language}: {state['name']}"}


state = {"name": "Mika"}
runtime = Runtime(MappingProxyType({"language": "你好"}))
result = {**state, **greet(state, runtime)}

print("result:", result)
print("context copied into state:", "language" in result)
