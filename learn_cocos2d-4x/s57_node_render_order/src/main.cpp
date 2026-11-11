#include "cocos/2d/CCCamera.h"
#include "cocos/2d/CCNode.h"
#include "cocos/renderer/CCRenderer.h"

int main() {
    cocos2d::Camera mainCamera(0x01);
    cocos2d::Node scene("Scene");
    cocos2d::Node overlay("Overlay", 1, true, 0x01, -1);
    cocos2d::Node cameraOnly("CameraOnly", 0, true, 0x02, 0);
    cocos2d::Node cameraChild("CameraChild", 0, true, 0x01, 1);
    cocos2d::Node back("Back", -1, true, 0x01, 0);
    cocos2d::Node hidden("Hidden", 2, false, 0x01, 0);
    cocos2d::Node hiddenChild("HiddenChild", 0, true, 0x01, 0);

    cameraOnly.addChild(&cameraChild);
    hidden.addChild(&hiddenChild);
    scene.addChild(&overlay);
    scene.addChild(&cameraOnly);
    scene.addChild(&hidden);
    scene.addChild(&back);

    cocos2d::backend::CommandBuffer commandBuffer;
    cocos2d::Renderer renderer(commandBuffer);
    scene.visit(mainCamera, renderer);
    renderer.render();
}
