#include "cocos2dx/include/CCMenu.h"

#include <iomanip>
#include <iostream>

using namespace cocos2d;

void print(const char* stage, const CCMenu& menu) {
  std::cout << stage << " positions:";
  for (const CCMenuItem* item : menu.getChildren()) {
    const CCPoint p = item->getPosition();
    std::cout << " (" << p.x << "," << p.y << ")";
  }
  std::cout << "\n";
}

int main() {
  CCMenu menu;
  CCMenuItem first({64, 40});
  CCMenuItem second({80, 40});
  CCMenuItem third({96, 40});
  CCMenuItem fourth({72, 40});

  menu.addChild(&first);
  menu.addChild(&second);
  menu.addChild(&third);
  menu.alignItemsHorizontallyWithPadding(12);
  print("three menu items", menu);

  menu.addChild(&fourth);
  menu.alignItemsHorizontallyWithPadding(12);
  print("after explicit relayout", menu);
  return 0;
}
