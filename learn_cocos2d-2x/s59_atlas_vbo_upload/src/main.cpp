#include "cocos2dx/textures/CCTextureAtlas.h"

int main() {
    GLDevice gl;
    CCTextureAtlas atlas(gl);
    const AtlasVertex quad[4] = {
        {0, 0, 0, {255, 255, 255, 255}, 0, 0},
        {64, 0, 0, {255, 255, 255, 255}, 1, 0},
        {0, 32, 0, {255, 255, 255, 255}, 0, 1},
        {64, 32, 0, {255, 255, 255, 255}, 1, 1},
    };
    atlas.updateQuad(quad);
    atlas.drawNumberOfQuads(1);
}
