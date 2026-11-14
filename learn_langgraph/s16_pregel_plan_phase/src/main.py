subscribers = {
    "question": {"classify", "audit"},
    "category": {"reply"},
    "answer": {"archive"},
}
updated_channels = {"question"}

planned = sorted(
    node
    for channel in updated_channels
    for node in subscribers.get(channel, set())
)
print("updated channels:", sorted(updated_channels))
print("planned nodes  :", planned)
