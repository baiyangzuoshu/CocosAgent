from dataclasses import dataclass

@dataclass
class Document:
    page_content: str
    metadata: dict[str, str]

class MemoryLoader:
    def __init__(self, records):
        self.records = records

    def lazy_load(self):
        for content, source in self.records:
            yield Document(content, {"source": source})

documents = list(MemoryLoader([
    ("Use a Runnable to compose steps.", "guide.md"),
]).lazy_load())
for document in documents:
    print("source=" + document.metadata["source"])
    print("content=" + document.page_content)
