#include "CommandBuffer.h"

#include <iostream>

namespace backend {

void CommandBuffer::drawElements(
    const std::string& materialId,
    std::size_t indexCount,
    std::size_t firstIndex) const {
    std::cout << "CommandBuffer drawElements: material=" << materialId
              << " indices=" << indexCount << " firstIndex=" << firstIndex << "\n";
}

} // namespace backend
