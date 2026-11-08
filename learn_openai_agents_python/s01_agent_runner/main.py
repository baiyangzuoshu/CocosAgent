from agents import Agent, Runner
from agents.testing import ScriptedModel, assistant_message


model = ScriptedModel(steps=[[assistant_message("出口在广场东侧。")]])
agent = Agent(
    name="场景导览助手",
    instructions="回答玩家关于场景路线的问题。",
    model=model,
)

result = Runner.run_sync(agent, "出口在哪里？")
print(result.final_output)
model.assert_complete()
