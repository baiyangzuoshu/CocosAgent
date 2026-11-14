documents = {"prefab": "Prefab nodes are cloned."}

def retrieve(question):
    key = "prefab" if "prefab" in question.lower() else "none"
    return documents.get(key, "No match.")

def answer(context):
    return "Found: " + context

def retrieval_qa(question):
    return answer(retrieve(question))

def runnable_rag(question):
    context = retrieve(question)
    prompt = f"Use this context: {context}"
    return answer(prompt.removeprefix("Use this context: "))

question = "How are prefab nodes handled?"
print("classic:", retrieval_qa(question))
print("runnable:", runnable_rag(question))
