def split_document(text, source, size=6, overlap=2):
    chunks = []
    start = 0
    while start < len(text):
        end = min(start + size, len(text))
        chunks.append((text[start:end], {"source": source}))
        if end == len(text):
            break
        start = end - overlap
    return chunks

for index, (content, metadata) in enumerate(
    split_document("abcdefghij", "notes.txt"), start=1
):
    print(f"chunk {index}: {content} source={metadata['source']}")
