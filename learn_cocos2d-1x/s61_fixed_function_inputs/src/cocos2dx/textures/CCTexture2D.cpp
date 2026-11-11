#include "cocos2dx/include/CCTexture2D.h"

#include <iostream>

void GLClientState::bindTexture(const std::string& name) {
    std::cout << "glBindTexture(GL_TEXTURE_2D, " << name << ")\n";
}

void GLClientState::vertexPointer(const float* values, int components) {
    std::cout << "glVertexPointer(components=" << components << ", first=" << values[0] << ")\n";
}

void GLClientState::texCoordPointer(const float* values, int components) {
    std::cout << "glTexCoordPointer(components=" << components << ", first=" << values[0] << ")\n";
}

void GLClientState::drawTriangleStrip(int vertexCount) {
    std::cout << "glDrawArrays(GL_TRIANGLE_STRIP, 0, " << vertexCount << ")\n";
}

void CCTexture2D::drawAtPoint(float x, float y) {
    const std::array<float, 12> vertices = {
        x, y, 0, x + 1, y, 0, x, y + 1, 0, x + 1, y + 1, 0,
    };
    const std::array<float, 8> coordinates = {0, 1, 1, 1, 0, 0, 1, 0};

    m_gl.bindTexture(m_texture);
    m_gl.vertexPointer(vertices.data(), 3);
    m_gl.texCoordPointer(coordinates.data(), 2);
    m_gl.drawTriangleStrip(4);
}
