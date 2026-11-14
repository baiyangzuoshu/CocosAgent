class Agent:
    def __init__(self, model, tools):
        self.model = model
        self.tools = {tool["name"]: tool for tool in tools}
        self.nodes = ["model", "tools", "model"]

def create_agent(model, tools):
    return Agent(model, tools)

agent = create_agent(
    model="fake-chat-model",
    tools=[{"name": "weather"}],
)
print("nodes:", agent.nodes)
print("tools:", sorted(agent.tools))
