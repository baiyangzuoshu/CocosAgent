#pragma once

#include <cstddef>
#include <string>

namespace backend {

class CommandBuffer {
public:
    void drawElements(
        const std::string& materialId,
        std::size_t indexCount,
        std::size_t firstIndex) const;
};

} // namespace backend
