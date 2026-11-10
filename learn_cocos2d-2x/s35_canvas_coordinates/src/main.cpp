#include "cocos2dx/CCDirector.h"
#include "cocos2dx/layers_scenes_transitions_nodes/CCLayer.h"

#include <iomanip>
#include <iostream>

using namespace cocos2d;

int main() {
  CCEGLViewProtocol view(1280, 720);
  view.setDesignResolutionSize(960, 640, kResolutionShowAll);
  CCDirector director(view);
  CCLayer uiRoot;
  uiRoot.init(director);

  const CCSize root = uiRoot.getContentSize();
  const CCRect viewport = view.getViewPortRect();
  const CCPoint center = view.convertToFrame({root.width / 2, root.height / 2});
  std::cout << std::fixed << std::setprecision(1)
            << "design=" << root.width << "x" << root.height
            << " visible=" << director.getVisibleSize().width << "x"
            << director.getVisibleSize().height << "\n"
            << "scale=1.125 viewport=(" << viewport.x << "," << viewport.y
            << "," << viewport.width << "," << viewport.height << ")\n"
            << "CCLayer center -> frame=(" << center.x << "," << center.y << ")\n";
  return 0;
}
