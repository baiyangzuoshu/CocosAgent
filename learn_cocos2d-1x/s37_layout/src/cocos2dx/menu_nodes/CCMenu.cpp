#include "cocos2dx/include/CCMenu.h"

namespace cocos2d {

void CCMenu::addChild(CCMenuItem* item) {
  _children.push_back(item);
}

void CCMenu::alignItemsHorizontallyWithPadding(float padding) {
  float width = -padding;
  for (CCMenuItem* child : _children) {
    width += child->getContentSize().width + padding;
  }

  float x = -width / 2.0f;
  for (CCMenuItem* child : _children) {
    const float childWidth = child->getContentSize().width;
    child->setPosition({x + childWidth / 2.0f, 0});
    x += childWidth + padding;
  }
}

} // namespace cocos2d
