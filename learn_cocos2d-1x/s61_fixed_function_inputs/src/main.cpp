#include "cocos2dx/include/CCTexture2D.h"

int main() {
    GLClientState gl;
    CCTexture2D texture(gl);
    texture.drawAtPoint(-0.5f, -0.5f);
}
