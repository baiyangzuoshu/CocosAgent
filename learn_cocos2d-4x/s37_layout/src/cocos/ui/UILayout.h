#ifndef COURSE_4X_UILayout_H
#define COURSE_4X_UILayout_H

#include "UIWidget.h"
#include "UILayoutManager.h"
#include <vector>

namespace cocos2d { namespace ui {

enum class LayoutType { ABSOLUTE, HORIZONTAL, VERTICAL, RELATIVE };

class Layout : public Widget, public LayoutProtocol {
public:
  explicit Layout(Size size) : Widget("Layout", size), _size(size) {}

  void setLayoutType(LayoutType type);
  void addChild(Widget* child);
  void requestDoLayout();
  void forceDoLayout();
  void visit();
  const std::vector<Widget*>& getChildren() const { return _children; }

  Size getLayoutContentSize() const override { return _size; }
  const std::vector<Widget*>& getLayoutElements() const override { return _children; }

private:
  LayoutManager* createLayoutManager() const;
  void doLayout();

  Size _size;
  LayoutType _layoutType = LayoutType::ABSOLUTE;
  bool _doLayoutDirty = true;
  std::vector<Widget*> _children;
};

}} // namespace cocos2d::ui

#endif
