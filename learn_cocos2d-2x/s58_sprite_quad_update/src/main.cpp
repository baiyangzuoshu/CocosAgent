#include "cocos2dx/sprite_nodes/CCSprite.h"
#include "cocos2dx/textures/CCTextureAtlas.h"
#include <iostream>

int main() {
    CCTextureAtlas atlas;
    CCSprite sprite(atlas, 0);
    sprite.setTextureRect(64, 32);
    sprite.updateColor({255, 180, 90, 128});

    const auto& stored = atlas.quadAt(0);
    std::cout << "TextureAtlas.updateQuad -> CPU quad copied\n";
    std::cout << "BL rgba=(" << static_cast<int>(stored.bl.colors.r) << ","
              << static_cast<int>(stored.bl.colors.g) << ","
              << static_cast<int>(stored.bl.colors.b) << ","
              << static_cast<int>(stored.bl.colors.a) << ")\n";
    std::cout << "VBO dirty=" << (atlas.dirty() ? "true" : "false") << "\n";
}
