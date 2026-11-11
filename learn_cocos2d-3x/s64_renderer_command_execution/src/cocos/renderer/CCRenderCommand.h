#pragma once

class RenderCommand {
public:
    explicit RenderCommand(int id) : _globalOrder(id) {}
    virtual ~RenderCommand() = default;
    int getGlobalOrder() const { return _globalOrder; }
    virtual void execute() = 0;

private:
    int _globalOrder;
};
