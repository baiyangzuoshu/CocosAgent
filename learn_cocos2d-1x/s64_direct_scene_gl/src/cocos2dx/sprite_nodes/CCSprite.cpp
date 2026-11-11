#include "CCSprite.h"

#include "../CCOpenGL.h"

CCSprite::CCSprite(std::string name, unsigned int texture)
    : CCNode(std::move(name)), _texture(texture) {}

void CCSprite::draw() {
    std::cout << "CCSprite::draw " << _name << "\n";
    glBindTexture(GL_TEXTURE_2D, _texture);
    glVertexPointer();
    glColorPointer();
    glTexCoordPointer();
    glDrawArrays();
}
