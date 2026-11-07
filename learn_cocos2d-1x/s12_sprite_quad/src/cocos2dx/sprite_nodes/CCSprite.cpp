#include "../include/CCSprite.h"
#include <iostream>

namespace cocos2d {
void CCSprite::draw() const {
    std::cout << "CCSprite::draw " << getName() << ": " << _quad.size() << " vertices\n";
    std::cout << "glVertexPointer + glTexCoordPointer\n";
    std::cout << "glDrawArrays(GL_TRIANGLE_STRIP, 0, 4)\n";
}
} // namespace cocos2d
