#include "CCSprite.h"

#include "../CCOpenGL.h"

CCSprite::CCSprite(std::string name, unsigned int texture)
    : CCNode(std::move(name)), _texture(texture) {}

void CCSprite::draw() {
    _programState.apply(_name.c_str());
    ccGLBlendFunc();
    ccGLBindTexture2D(_texture);
    glVertexAttribPointer("position");
    glVertexAttribPointer("texCoord");
    glVertexAttribPointer("color");
    glDrawArrays();
}
