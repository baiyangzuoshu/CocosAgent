#include "BufferGL.h"

#include <iostream>

namespace backend {

void BufferGL::updateData(void* data, std::size_t size) {
    std::cout << "BufferGL::updateData -> glBufferData bytes=" << size
              << " data=" << (data ? "provided" : "null") << "\n";
}

void BufferGL::updateSubData(void* data, std::size_t offset, std::size_t size) {
    std::cout << "BufferGL::updateSubData -> glBufferSubData offset=" << offset
              << " bytes=" << size << " data=" << (data ? "provided" : "null") << "\n";
}

} // namespace backend
