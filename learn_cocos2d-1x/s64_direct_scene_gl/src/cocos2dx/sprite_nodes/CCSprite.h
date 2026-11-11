#pragma once

#include "../base_nodes/CCNode.h"

class CCSprite : public CCNode {
public:
    CCSprite(std::string name, unsigned int texture);
    void draw() override;

private:
    unsigned int _texture;
};
