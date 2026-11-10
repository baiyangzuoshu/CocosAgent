#include "UILayout.h"

namespace cocos2d { namespace ui {

void Layout::setLayoutType(LayoutType type) {
  _layoutType = type;
  _doLayoutDirty = true;
}

void Layout::addChild(Widget* child) {
  _children.push_back(child);
  _doLayoutDirty = true;
}

void Layout::visit() {
  sortAllChildren();
}

void Layout::sortAllChildren() {
  doLayout();
}

void Layout::doLayout() {
  if (!_doLayoutDirty || _layoutType != LAYOUT_LINEAR_HORIZONTAL) return;

  const Size layoutSize = getSize();
  float leftBoundary = 0.0f;
  for (Widget* child : _children) {
    const Point anchor = child->getAnchorPoint();
    const Size size = child->getSize();
    const LinearLayoutParameter& parameter = child->layoutParameter;
    const Margin margin = parameter.margin;

    float x = leftBoundary + anchor.x * size.width + margin.left;
    float y = layoutSize.height / 2.0f - size.height * (0.5f - anchor.y);
    y -= margin.top;
    child->setPosition({x, y});
    leftBoundary = child->getRightInParent() + margin.right;
  }
  _doLayoutDirty = false;
}

}} // namespace cocos2d::ui
