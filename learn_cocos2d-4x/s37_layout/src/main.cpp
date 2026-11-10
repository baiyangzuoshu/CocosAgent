#include "cocos/ui/UILayout.h"

#include <iostream>

using namespace cocos2d::ui;

void configure(Widget& child) {
  child.setAnchorPoint({0.5f, 0.5f});
  LinearLayoutParameter parameter;
  parameter.setMargin({8, 0, 4, 0});
  parameter.setGravity(LinearLayoutParameter::LinearGravity::CENTER_VERTICAL);
  child.setLayoutParameter(parameter);
}

void print(const char* stage, const Layout& layout) {
  std::cout << stage << " positions:";
  for (const Widget* child : layout.getChildren()) {
    const Vec2 p = child->getPosition();
    std::cout << " (" << p.x << "," << p.y << ")";
  }
  std::cout << "\n";
}

int main() {
  Layout row({400, 80});
  row.setLayoutType(LayoutType::HORIZONTAL);
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
