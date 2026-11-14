class Retry:
    def __init__(self, function, attempts):
        self.function = function
        self.attempts = attempts

    def invoke(self, value):
        for attempt in range(1, self.attempts + 1):
            try:
                return self.function(value)
            except RuntimeError:
                if attempt == self.attempts:
                    raise

class Fallback:
    def __init__(self, primary, backup):
        self.primary = primary
        self.backup = backup

    def invoke(self, value):
        try:
            return self.primary(value)
        except RuntimeError:
            return self.backup(value)

attempts = 0
def flaky(_value):
    global attempts
    attempts += 1
    if attempts < 3:
        raise RuntimeError("temporary")
    return "ready"

retry_result = Retry(flaky, attempts=3).invoke("input")
def fail(_value):
    raise RuntimeError("failed")
fallback_result = Fallback(fail, lambda _: "backup").invoke("input")
print(f"retry result: {retry_result} (attempts={attempts})")
print("fallback result:", fallback_result)
