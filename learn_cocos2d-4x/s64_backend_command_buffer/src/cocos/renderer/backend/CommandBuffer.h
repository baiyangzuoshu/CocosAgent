#pragma once

class CommandBuffer {
public:
    virtual ~CommandBuffer() = default;
    virtual void beginFrame() = 0;
    virtual void beginRenderPass() = 0;
    virtual void setProgramState(const char* program) = 0;
    virtual void setVertexBuffer(const char* buffer) = 0;
    virtual void setIndexBuffer(const char* buffer) = 0;
    virtual void drawElements(unsigned int count) = 0;
    virtual void endRenderPass() = 0;
    virtual void endFrame() = 0;
};
