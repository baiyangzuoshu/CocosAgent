#include "cocos2dx/include/CCSprite.h"

#include <iostream>

namespace {
const BlendFunc kDefaultBlend = {"ONE", "ONE_MINUS_SRC_ALPHA"};
}

void GLState::blendFunc(const BlendFunc& blend) {
    std::cout << "glBlendFunc(" << blend.src << ", " << blend.dst << ")\n";
}

void GLState::bindTexture2D(const std::string& texture) {
    std::cout << "glBindTexture(GL_TEXTURE_2D, " << texture << ")\n";
}

void GLState::setVertexPointers() {
    std::cout << "glVertexPointer / glColorPointer / glTexCoordPointer from m_sQuad\n";
}

void GLState::drawArrays(const char* primitive, int first, int count) {
    std::cout << "glDrawArrays(" << primitive << ", " << first << ", " << count << ")\n";
}

CCSprite::CCSprite(GLState& gl) : m_gl(gl), m_texture("white"), m_blend(kDefaultBlend) {}

void CCSprite::draw() {
    const bool newBlend = m_blend.src != kDefaultBlend.src || m_blend.dst != kDefaultBlend.dst;
    if (newBlend) m_gl.blendFunc(m_blend);

    m_gl.bindTexture2D(m_texture);
    m_gl.setVertexPointers();
    m_gl.drawArrays("GL_TRIANGLE_STRIP", 0, 4);

    if (newBlend) m_gl.blendFunc(kDefaultBlend);
}
