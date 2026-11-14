documents = {
    "scene": "Nodes form a scene tree.",
    "render": "The renderer draws visible sprites.",
}

def retrieve(question):
    key = "scene" if "node" in question.lower() else "render"
    return documents[key]

def format_prompt(context, question):
    return f"Context: {context}\nQuestion: {question}"

def fake_model(prompt):
    context = prompt.split("\n", 1)[0].removeprefix("Context: ")
    return "Source says: " + context

def invoke(question):
    context = retrieve(question)
    return fake_model(format_prompt(context, question))

print("answer:", invoke("What do nodes form?"))
