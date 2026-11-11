#include "CCNode.h"

#include <iostream>
#include <utility>

CCNode::CCNode(std::string name) : _name(std::move(name)) {}

void CCNode::visit() const {
    std::cout << "CCNode::visit and draw " << _name << "\n";
}
