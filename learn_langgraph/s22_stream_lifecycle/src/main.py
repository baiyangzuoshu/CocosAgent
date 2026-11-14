def stream_updates(question: str):
    state = {"question": question}
    normalized = question.strip()
    state["question"] = normalized
    yield {"clean": {"question": normalized}}

    answer = f"已收到：{normalized}"
    state["answer"] = answer
    yield {"reply": {"answer": answer}}


for event in stream_updates("  流式执行  "):
    print(event)
