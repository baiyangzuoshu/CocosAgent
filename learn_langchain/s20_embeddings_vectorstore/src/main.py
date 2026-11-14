from collections import Counter
from math import sqrt

def embed(text):
    return Counter(text.lower().split())

def cosine(left, right):
    dot = sum(left[word] * right[word] for word in left.keys() & right.keys())
    left_norm = sqrt(sum(value * value for value in left.values()))
    right_norm = sqrt(sum(value * value for value in right.values()))
    return dot / (left_norm * right_norm) if left_norm and right_norm else 0.0

class Retriever:
    def __init__(self, documents):
        self.documents = documents

    def invoke(self, query):
        query_vector = embed(query)
        return max(
            self.documents,
            key=lambda text: cosine(query_vector, embed(text)),
        )

retriever = Retriever(["dogs enjoy walks", "cats drink milk"])
print("top match:", retriever.invoke("cats milk"))
