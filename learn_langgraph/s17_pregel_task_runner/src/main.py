from concurrent.futures import ThreadPoolExecutor


def score(item: str) -> tuple[str, int]:
    return item, len(item) * 10


tasks = ["alpha", "beta"]
with ThreadPoolExecutor(max_workers=2) as executor:
    futures = {item: executor.submit(score, item) for item in tasks}
    results = {item: futures[item].result() for item in tasks}

print("submitted:", tasks)
print("results  :", results)
