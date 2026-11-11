#include "CCSprite.h"

#include <iostream>

namespace {
const BlendFunc kDefaultBlend = {"ONE", "ONE_MINUS_SRC_ALPHA"};
}

void CCGLProgram::use() const {
    std::cout << "CC_NODE_DRAW_SETUP -> CCGLProgram::use\n";
}

void CCGLProgram::setUniformsForBuiltins() const {
    std::cout << "CC_NODE_DRAW_SETUP -> setUniformsForBuiltins\n";
}

void GLState::blendFunc(const BlendFunc& blend) {
    std::cout << "ccGLBlendFunc(" << blend.src << ", " << blend.dst << ")\n";
}

void GLState::bindTexture2D(const std::string& texture) {
    std::cout << "ccGLBindTexture2D(" << texture << ")\n";
}

void GLState::enablePositionColorTex() {
    std::cout << "ccGLEnableVertexAttribs(POS_COLOR_TEX)\n";
}

void GLState::setVertexAttribPointers() {
    std::cout << "glVertexAttribPointer(position / texCoord / color)\n";
}

void GLState::drawArrays(const char* primitive, int first, int count) {
    std::cout << "glDrawArrays(" << primitive << ", " << first << ", " << count << ")\n";
}

CCSprite::CCSprite(GLState& gl)
    : m_gl(gl), m_texture("white"), m_blend(kDefaultBlend) {}

void CCSprite::draw() {
    CC_NODE_DRAW_SETUP();
    m_gl.blendFunc(m_blend);
    m_gl.bindTexture2D(m_texture);
    m_gl.enablePositionColorTex();
    m_gl.setVertexAttribPointers();
    m_gl.drawArrays("GL_TRIANGLE_STRIP", 0, 4);
}
