import json

def parse_proposal(text):
    value = json.loads(text)
    if set(value) != {"action", "amount"}:
        raise ValueError("unexpected response fields")
    return value

proposal = parse_proposal('{"action": "refund", "amount": 25}')
print("proposal:", proposal)

status = "paused"
human_decision = "approve"
if status == "paused" and human_decision == "approve":
    status = "approved"
print("status:", status)
