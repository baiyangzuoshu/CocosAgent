#include "UILayout.h"

namespace cocos2d { namespace ui {

void Layout::setLayoutType(LayoutType type) {
  _layoutType = type;
  for (Widget* child : _children) {
    if (!child->getLayoutParameter()) {
      child->setLayoutParameter(LinearLayoutParameter{});
    }
  }
  requestDoLayout();
}

void Layout::addChild(Widget* child) {
  if (_layoutType == LayoutType::HORIZONTAL && !child->getLayoutParameter()) {
    child->setLayoutParameter(LinearLayoutParameter{});
  }
  _children.push_back(child);
  requestDoLayout();
}

void Layout::requestDoLayout() {
  _doLayoutDirty = true;
}

void Layout::forceDoLayout() {
  requestDoLayout();
  doLayout();
}

void Layout::visit() {
  doLayout();
}

LayoutManager* Layout::createLayoutManager() const {
  if (_layoutType == LayoutType::HORIZONTAL) {
    return new LinearHorizontalLayoutManager();
  }
  return nullptr;
}

void Layout::doLayout() {
  if (!_doLayoutDirty) return;
  LayoutManager* executor = createLayoutManager();
  if (executor) {
    executor->doLayout(this);
    delete executor;
  }
  _doLayoutDirty = false;
}

}} // namespace cocos2d::ui
