#pragma once

#include "RenderPassDescriptor.h"

class CommandBuffer {
public:
    virtual ~CommandBuffer() = default;
    virtual void beginRenderPass(const RenderPassDescriptor& descriptor) = 0;
    virtual void drawScene() = 0;
    virtual void endRenderPass() = 0;
};
