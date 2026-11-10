#include "cocos/base/CCDirector.h"
#include "cocos/2d/CCLayer.h"

#include <iomanip>
#include <iostream>

using namespace cocos2d;

int main() {
  GLView view(1280, 720);
  Director director;
  director.setOpenGLView(&view);
  view.setDesignResolutionSize(960, 640, ResolutionPolicy::SHOW_ALL);
  Layer uiRoot;
  uiRoot.init(director);

  const Size root = uiRoot.getContentSize();
  const Rect viewport = view.getViewPortRect();
  const Vec2 center = view.convertToFrame({root.width / 2, root.height / 2});
  std::cout << std::fixed << std::setprecision(1)
            << "design=" << root.width << "x" << root.height
            << " visible=" << director.getVisibleSize().width << "x"
            << director.getVisibleSize().height << "\n"
            << "scale=1.125 viewport=(" << viewport.x << "," << viewport.y
            << "," << viewport.width << "," << viewport.height << ")\n"
            << "Layer center -> frame=(" << center.x << "," << center.y << ")\n";
  return 0;
}
