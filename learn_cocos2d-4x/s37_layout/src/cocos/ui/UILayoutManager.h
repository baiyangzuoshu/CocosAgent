#ifndef COURSE_4X_UILAYOUT_MANAGER_H
#define COURSE_4X_UILAYOUT_MANAGER_H

#include "UIWidget.h"
#include <vector>

namespace cocos2d { namespace ui {

class LayoutProtocol {
public:
  virtual ~LayoutProtocol() = default;
  virtual Size getLayoutContentSize() const = 0;
  virtual const std::vector<Widget*>& getLayoutElements() const = 0;
};

class LayoutManager {
public:
  virtual ~LayoutManager() = default;
  virtual void doLayout(LayoutProtocol* layout) = 0;
};

class LinearHorizontalLayoutManager : public LayoutManager {
public:
  void doLayout(LayoutProtocol* layout) override;
};

}} // namespace cocos2d::ui

#endif
