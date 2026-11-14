class ChatPromptTemplate:
    def __init__(self, messages):
        self.messages = messages

    def format_messages(self, values):
        return [
            (role, template.format(**values))
            for role, template in self.messages
        ]

prompt = ChatPromptTemplate([
    ("system", "Answer briefly."),
    ("human", "What is {left} + {right}?"),
])
for role, content in prompt.format_messages({"left": 2, "right": 2}):
    print(f"{role}: {content}")
