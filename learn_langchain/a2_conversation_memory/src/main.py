class ConversationBufferWindowMemory:
    def __init__(self, window):
        self.window = window
        self.messages = []

    def save_context(self, user, assistant):
        self.messages.extend([user, assistant])

    def load_memory_variables(self):
        return self.messages[-2 * self.window:]

memory = ConversationBufferWindowMemory(window=2)
for user, assistant in [("u1", "a1"), ("u2", "a2"), ("u3", "a3")]:
    memory.save_context(user, assistant)
print("history:", memory.load_memory_variables())
