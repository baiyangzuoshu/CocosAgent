from copy import deepcopy
from typing import Any

Config = tuple[str, str]


class MiniSaver:
    def __init__(self) -> None:
        self.records: dict[Config, dict[str, Any]] = {}

    def put(self, config: Config, checkpoint: dict[str, Any]) -> None:
        self.records[config] = deepcopy(checkpoint)

    def get(self, config: Config) -> dict[str, Any] | None:
        value = self.records.get(config)
        return deepcopy(value) if value is not None else None


saver = MiniSaver()
key = ("case-1", "checkpoint-1")
saver.put(key, {"values": {"count": 2}})
print("loaded:", saver.get(key))
print("record count:", len(saver.records))
