#include "CCSprite.h"
#include "../renderer/CCRenderer.h"

namespace cocos2d {
void Sprite::draw(Renderer& renderer) const {
    TrianglesCommand::Triangles triangles;
    triangles.vertices = {{-28, -28}, {28, -28}, {-28, 28}, {28, 28}};
    triangles.indices = {0, 1, 2, 2, 1, 3};
    TrianglesCommand command;
    command.init(triangles);
    renderer.addCommand(getName(), getGlobalZOrder(), command);
}
} // namespace cocos2d
