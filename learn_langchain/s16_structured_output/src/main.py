import json
from dataclasses import dataclass

@dataclass
class Ticket:
    category: str
    urgent: bool

def parse_ticket(text):
    values = json.loads(text)
    if not isinstance(values.get("category"), str):
        raise ValueError("category must be a string")
    if not isinstance(values.get("urgent"), bool):
        raise ValueError("urgent must be a boolean")
    return Ticket(**values)

ticket = parse_ticket('{"category": "billing", "urgent": true}')
print(ticket)
