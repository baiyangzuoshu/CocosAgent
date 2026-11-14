START = "__start__"
END = "__end__"
edges = {
    START: "load",
    "load": "normalize",
    "normalize": END,
}

order = []
current = edges[START]
while current != END:
    order.append(current)
    current = edges[current]

print("node order:", order)
print("stopped at:", END)
