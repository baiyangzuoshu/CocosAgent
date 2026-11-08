#include "CCSprite.h"
#include "CCSpriteFrame.h"
#include "../renderer/CCRenderer.h"

namespace cocos2d {
void Sprite::draw(Renderer& renderer) const {
    if (!_spriteFrame || !_spriteFrame->getTexture()) return;
    const auto& rect = _spriteFrame->getRect();
    Texture2D* texture = _spriteFrame->getTexture();
    const float u0 = rect.x / texture->width();
    const float u1 = (rect.x + rect.width) / texture->width();
    const float v0 = rect.y / texture->height();
    const float v1 = (rect.y + rect.height) / texture->height();
    TrianglesCommand::Triangles triangles;
    triangles.vertices = {{-28, -28, u0, v0}, {28, -28, u1, v0}, {-28, 28, u0, v1}, {28, 28, u1, v1}};
    triangles.indices = {0, 1, 2, 2, 1, 3};
    TrianglesCommand command;
    command.init(texture, triangles);
    renderer.addCommand(getName(), getGlobalZOrder(), command);
}
} // namespace cocos2d
