#pragma once

#include <string>

struct RenderPassDescriptor {
    std::string colorAttachment;
    std::string depthStencilAttachment;
};
