#include "cocos/3d/CCSprite3D.h"
#include "cocos/renderer/CCRenderer.h"

int main() {
    Sprite3D robot("model-view");
    robot.addMesh(Mesh("body", "body-material", 36));
    robot.addMesh(Mesh("head", "head-material", 24));

    Renderer renderer;
    robot.draw(renderer);
    renderer.inspectQueue();
}
