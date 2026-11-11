#pragma once

#include <cstddef>

namespace backend {

class Buffer {
public:
    virtual ~Buffer() = default;
    virtual void updateData(void* data, std::size_t size) = 0;
    virtual void updateSubData(void* data, std::size_t offset, std::size_t size) = 0;
};

} // namespace backend
