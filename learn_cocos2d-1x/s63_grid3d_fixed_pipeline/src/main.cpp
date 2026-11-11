#include "cocos2dx/CCCamera.h"
#include "cocos2dx/effects/CCGrid.h"

#include <iostream>

int main() {
    CCCamera camera;
    camera.setEyeXYZ(0.0f, 0.0f, 5.0f);
    camera.locate();

    CCGrid3D grid(1, 1);
    grid.setVertex({1, 1}, {1.0f, 1.0f, 0.5f});
    const ccVertex3F raised = grid.vertex({1, 1});
    std::cout << "grid vertex z=" << raised.z << "; this is a textured grid effect, not a MeshRenderer\n";
    grid.blit();
}
