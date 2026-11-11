#pragma once

#include "../CommandBuffer.h"

class CommandBufferGL final : public CommandBuffer {
public:
    void beginFrame() override;
    void beginRenderPass() override;
    void setProgramState(const char* program) override;
    void setVertexBuffer(const char* buffer) override;
    void setIndexBuffer(const char* buffer) override;
    void drawElements(unsigned int count) override;
    void endRenderPass() override;
    void endFrame() override;
};
