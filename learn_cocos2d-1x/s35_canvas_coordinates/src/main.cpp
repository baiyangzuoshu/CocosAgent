#include "cocos2dx/include/CCDirector.h"
#include "cocos2dx/include/CCLayer.h"

#include <iomanip>
#include <iostream>

using namespace cocos2d;

int main() {
  CCDirector director(1280, 720, 2.0f);
  CCLayer uiRoot;
  uiRoot.init(director);
  const CCSize points = director.getWinSize();
  const CCSize pixels = director.getWinSizeInPixels();
  const CCSize root = uiRoot.getContentSize();

  std::cout << std::fixed << std::setprecision(1)
            << "window points=" << points.width << "x" << points.height
            << " pixels=" << pixels.width << "x" << pixels.height << "\n"
            << "CCLayer root=" << root.width << "x" << root.height
            << " center=(" << root.width / 2 << "," << root.height / 2 << ")\n"
            << "resolution policy=none; screen mapping uses window points\n";
  return 0;
}
