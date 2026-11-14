checkpoint = {
    "channel_values": {"count": 2, "answer": "pending"},
    "channel_versions": {"count": 3, "answer": 1},
}
writes = {"answer": "complete"}

for channel, value in writes.items():
    checkpoint["channel_values"][channel] = value
    checkpoint["channel_versions"][channel] += 1

print("values :", checkpoint["channel_values"])
print("versions:", checkpoint["channel_versions"])
