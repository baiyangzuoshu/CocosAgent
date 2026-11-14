START = "__start__"
END = "__end__"

nodes = {"clean", "reply"}
edges = [(START, "clean"), ("clean", "reply"), ("reply", END)]

actors = {
    name: {
        "triggers": [f"branch:to:{name}"],
        "reads": ["state channels"],
        "writes": ["state updates", "branch control"],
    }
    for name in sorted(nodes)
}
channels = {START: "input channel"}
channels.update(
    {f"branch:to:{name}": "EphemeralValue[Any]" for name in sorted(nodes)}
)

print("actors:", actors)
print("channels:", channels)
print("edges:", edges)
