class FakeMCPServer:
    def list_tools(self):
        return [{"name": "lookup", "description": "Find a record"}]

    def call_tool(self, name, arguments):
        return f"record-{arguments['id']}"

class MCPAdapter:
    def __init__(self, server):
        self.server = server
        self.tools = {item["name"]: item for item in server.list_tools()}

    def invoke(self, name, arguments):
        if name not in self.tools:
            raise KeyError(name)
        return self.server.call_tool(name, arguments)

adapter = MCPAdapter(FakeMCPServer())
print("tools:", sorted(adapter.tools))
print("result:", adapter.invoke("lookup", {"id": 7}))
