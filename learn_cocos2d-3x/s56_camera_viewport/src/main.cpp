#include "cocos/base/CCDirector.h"
#include "cocos/2d/CCCamera.h"
#include "cocos/2d/CCScene.h"
#include "cocos/renderer/CCRenderer.h"

int main() {
    cocos2d::GLView view;
    cocos2d::Director director(view);
    director.setProjection(cocos2d::Projection::_2D);

    cocos2d::Camera mainCamera("Main", 0, 0, 0, 960, 640);
    cocos2d::Camera overlayCamera("Overlay", 10, 480, 0, 480, 640);
    cocos2d::Scene scene(director);
    scene.addCamera(&overlayCamera);
    scene.addCamera(&mainCamera);

    cocos2d::Renderer renderer;
    scene.render(&renderer);
}
