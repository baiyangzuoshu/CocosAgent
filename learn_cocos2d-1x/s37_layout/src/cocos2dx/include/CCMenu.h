#ifndef COURSE_1X_CCMENU_H
#define COURSE_1X_CCMENU_H

#include "CCNode.h"
#include <vector>

namespace cocos2d {

class CCMenu : public CCNode {
public:
  CCMenu() : CCNode({0, 0}) {}

  void addChild(CCMenuItem* item);
  void alignItemsHorizontallyWithPadding(float padding);
  const std::vector<CCMenuItem*>& getChildren() const { return _children; }

private:
  std::vector<CCMenuItem*> _children;
};

} // namespace cocos2d

#endif
