#include "../include/CCSprite.h"
#include "../include/CCSpriteFrame.h"
#include "../textures/CCTextureCache.h"
#include <iomanip>
#include <iostream>

namespace cocos2d {
void CCSprite::setDisplayFrame(const CCSpriteFrame* frame) {
    if (!frame || !frame->getTexture()) return;
    _texture = frame->getTexture();
    const auto& rect = frame->getRectInPixels();
    const float u0 = rect.x / _texture->pixelsWide();
    const float u1 = (rect.x + rect.width) / _texture->pixelsWide();
    const float v0 = rect.y / _texture->pixelsHigh();
    const float v1 = (rect.y + rect.height) / _texture->pixelsHigh();
    _quad[0].u = u0; _quad[0].v = v0;
    _quad[1].u = u1; _quad[1].v = v0;
    _quad[2].u = u0; _quad[2].v = v1;
    _quad[3].u = u1; _quad[3].v = v1;
}

void CCSprite::draw() const {
    std::cout << "CCSprite::draw " << getName() << ": texture="
              << (_texture ? _texture->path() : "none") << ", " << _quad.size() << " vertices\n";
    std::cout << std::fixed << std::setprecision(2) << "UV: ";
    for (const Vertex& vertex : _quad) std::cout << "(" << vertex.u << "," << vertex.v << ") ";
    std::cout << "\n";
    std::cout << "glBindTexture + glVertexPointer + glTexCoordPointer\n";
    std::cout << "glDrawArrays(GL_TRIANGLE_STRIP, 0, 4)\n";
}
} // namespace cocos2d
