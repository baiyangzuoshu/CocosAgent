#include "cocos2dx/include/CCCamera.h"
#include "cocos2dx/include/CCDirector.h"

int main() {
    CCGLView view;
    CCDirector director(view);
    director.setProjection(kCCDirectorProjection2D);

    CCCamera camera;
    camera.setEyeXYZ(480, 320, 1);
    camera.locate();
}
