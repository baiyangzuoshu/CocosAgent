value = 0
step = 0
recursion_limit = 4

while value < 3:
    if step >= recursion_limit:
        raise RuntimeError("recursion limit reached")
    step += 1
    value += 1
    print(f"step {step}: value={value}")

print(f"stopped after {step} steps")
