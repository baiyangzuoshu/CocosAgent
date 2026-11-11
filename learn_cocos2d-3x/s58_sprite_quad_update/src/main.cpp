#include "cocos/2d/CCSprite.h"
#include "cocos/renderer/CCRenderer.h"

int main() {
    cocos2d::Sprite sprite;
    sprite.setTextureRect(64, 32);
    sprite.updateColor(255, 180, 90, 128);

    cocos2d::Renderer renderer;
    sprite.draw(renderer, "Node.worldTransform");
    renderer.render();
}
