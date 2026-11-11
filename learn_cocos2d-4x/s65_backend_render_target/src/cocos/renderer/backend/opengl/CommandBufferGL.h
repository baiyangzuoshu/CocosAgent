#pragma once

#include "../CommandBuffer.h"

class CommandBufferGL final : public CommandBuffer {
public:
    void beginRenderPass(const RenderPassDescriptor& descriptor) override;
    void drawScene() override;
    void endRenderPass() override;
};
