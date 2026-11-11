#include "cocos/3d/CCSprite3D.h"
#include "cocos/renderer/CCMaterial.h"
#include "cocos/renderer/CCRenderer.h"

int main() {
    Material bodyMaterial({"forward", "shadow"});
    Material glassMaterial({"transparent"});
    Sprite3D robot("model-view");
    robot.addMesh(Mesh("body", bodyMaterial, 36));
    robot.addMesh(Mesh("glass", glassMaterial, 12));

    Renderer renderer;
    robot.draw(renderer);
    renderer.inspectQueue();
}
