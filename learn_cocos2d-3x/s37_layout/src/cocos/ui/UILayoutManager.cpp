#include "UILayoutManager.h"

namespace cocos2d { namespace ui {

void LinearHorizontalLayoutManager::doLayout(LayoutProtocol* layout) {
  const Size layoutSize = layout->getLayoutContentSize();
  float leftBoundary = 0.0f;
  for (Widget* child : layout->getLayoutElements()) {
    LinearLayoutParameter* parameter = child->getLayoutParameter();
    if (!parameter) continue;

    const Vec2 anchor = child->getAnchorPoint();
    const Size size = child->getContentSize();
    const Margin margin = parameter->getMargin();
    float y = layoutSize.height - (1.0f - anchor.y) * size.height;
    if (parameter->getGravity()
        == LinearLayoutParameter::LinearGravity::CENTER_VERTICAL) {
      y = layoutSize.height / 2.0f - size.height * (0.5f - anchor.y);
    }

    const float x = leftBoundary + anchor.x * size.width + margin.left;
    child->setPosition({x, y - margin.top});
    leftBoundary = child->getRightBoundary().x + margin.right;
  }
}

}} // namespace cocos2d::ui
