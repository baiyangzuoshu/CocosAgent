#include "extensions/CocoStudio/GUI/Layouts/UILayout.h"

#include <iostream>

using namespace cocos2d::ui;

void configure(Widget& child) {
  child.setAnchorPoint({0.5f, 0.5f});
  child.layoutParameter.margin = {8, 0, 4, 0};
  child.layoutParameter.gravity = LINEAR_GRAVITY_CENTER_VERTICAL;
}

void print(const char* stage, const Layout& layout) {
  std::cout << stage << " positions:";
  for (const Widget* child : layout.getChildren()) {
    const Point p = child->getPosition();
    std::cout << " (" << p.x << "," << p.y << ")";
  }
  std::cout << "\n";
}

int main() {
  Layout row({400, 80});
  row.setLayoutType(LAYOUT_LINEAR_HORIZONTAL);
  Widget first("A", {64, 40});
  Widget second("B", {80, 40});
  Widget third("C", {96, 40});
  Widget fourth("D", {72, 40});
  configure(first);
  configure(second);
  configure(third);
  configure(fourth);

  row.addChild(&first);
  row.addChild(&second);
  row.addChild(&third);
  row.visit();
  print("three widgets", row);

  row.addChild(&fourth);
  row.visit();
  print("after visit", row);
  return 0;
}
