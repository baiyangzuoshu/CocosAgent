#include "CommandBufferGL.h"

#include <iostream>

void CommandBufferGL::beginFrame() { std::cout << "CommandBufferGL.beginFrame\n"; }
void CommandBufferGL::beginRenderPass() { std::cout << "CommandBufferGL.beginRenderPass\n"; }
void CommandBufferGL::setProgramState(const char* program) {
    std::cout << "CommandBufferGL.setProgramState(" << program << ")\n";
}
void CommandBufferGL::setVertexBuffer(const char* buffer) {
    std::cout << "CommandBufferGL.setVertexBuffer(" << buffer << ")\n";
}
void CommandBufferGL::setIndexBuffer(const char* buffer) {
    std::cout << "CommandBufferGL.setIndexBuffer(" << buffer << ")\n";
}
void CommandBufferGL::drawElements(unsigned int count) {
    std::cout << "CommandBufferGL.prepareDrawing -> glDrawElements(TRIANGLES, " << count << ")\n";
}
void CommandBufferGL::endRenderPass() { std::cout << "CommandBufferGL.endRenderPass\n"; }
void CommandBufferGL::endFrame() { std::cout << "CommandBufferGL.endFrame\n"; }
