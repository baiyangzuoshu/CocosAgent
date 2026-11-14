class PromptValue:
    def __init__(self, text):
        self.text = text

    def to_string(self):
        return self.text

class PromptTemplate:
    def __init__(self, template, required_variables):
        self.template = template
        self.required_variables = set(required_variables)

    def format_prompt(self, values):
        missing = self.required_variables - values.keys()
        if missing:
            raise ValueError(f"missing variables: {sorted(missing)}")
        return PromptValue(self.template.format(**values))

prompt = PromptTemplate(
    "Tell a short story about a {subject}.", ["subject"]
).format_prompt({"subject": "comet"})
print(prompt.to_string())
