#ifndef COURSE_2X_UILAYOUT_H
#define COURSE_2X_UILAYOUT_H

#include "extensions/CocoStudio/GUI/BaseClasses/UIWidget.h"
#include "UILayoutParameter.h"
#include <vector>

namespace cocos2d { namespace ui {

enum LayoutType { LAYOUT_ABSOLUTE, LAYOUT_LINEAR_HORIZONTAL };

class Layout : public Widget {
public:
  explicit Layout(Size size) : Widget("Layout", size) {}

  void setLayoutType(LayoutType type);
  void addChild(Widget* child);
  void visit();
  const std::vector<Widget*>& getChildren() const { return _children; }

private:
  void sortAllChildren();
  void doLayout();

  LayoutType _layoutType = LAYOUT_ABSOLUTE;
  bool _doLayoutDirty = true;
  std::vector<Widget*> _children;
};

}} // namespace cocos2d::ui

#endif
