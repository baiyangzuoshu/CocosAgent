#include "CCRenderTexture.h"

#include <iostream>
#include <utility>

namespace {
void glGetFramebufferBinding(unsigned int& value) {
    value = 4;
    std::cout << "save GL_FRAMEBUFFER_BINDING\n";
}
void glBindFramebuffer(unsigned int value) { std::cout << "glBindFramebuffer(" << value << ")\n"; }
void glViewport(int width, int height) { std::cout << "glViewport(" << width << ", " << height << ")\n"; }
void glClear() { std::cout << "glClear(color/depth/stencil flags)\n"; }
}

CCRenderTexture::CCRenderTexture(unsigned int framebuffer, std::string texture, int width, int height)
    : _framebuffer(framebuffer), _width(width), _height(height), _texture(std::move(texture)) {
    std::cout << "CCRenderTexture creates FBO with optional depth/stencil attachment\n";
}

void CCRenderTexture::beginWithClear() {
    begin();
    glClear();
}

void CCRenderTexture::begin() {
    std::cout << "kmGLPushMatrix(PROJECTION)\n";
    std::cout << "kmGLPushMatrix(MODELVIEW)\n";
    std::cout << "Director::setProjection + multiply texture-size orthographic matrix\n";
    glViewport(_width, _height);
    glGetFramebufferBinding(_oldFramebuffer);
    glBindFramebuffer(_framebuffer);
}

void CCRenderTexture::end() {
    glBindFramebuffer(_oldFramebuffer);
    std::cout << "Director::setViewport\n";
    std::cout << "kmGLPopMatrix(PROJECTION)\n";
    std::cout << "kmGLPopMatrix(MODELVIEW)\n";
}

const std::string& CCRenderTexture::getSpriteTexture() const {
    return _texture;
}
