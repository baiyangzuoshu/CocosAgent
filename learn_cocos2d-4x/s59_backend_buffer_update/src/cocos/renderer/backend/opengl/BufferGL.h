#pragma once

#include "../Buffer.h"

namespace backend {

class BufferGL : public Buffer {
public:
    void updateData(void* data, std::size_t size) override;
    void updateSubData(void* data, std::size_t offset, std::size_t size) override;
};

} // namespace backend
