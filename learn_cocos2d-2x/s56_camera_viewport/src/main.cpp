#include "cocos2dx/include/CCCamera.h"
#include "cocos2dx/include/CCDirector.h"

int main() {
    cocos2d::CCGLView view;
    cocos2d::CCDirector director(view);
    director.setProjection(cocos2d::kCCDirectorProjection2D);

    cocos2d::CCCamera camera;
    camera.setEyeXYZ(480, 320, 1);
    camera.locate();
}
