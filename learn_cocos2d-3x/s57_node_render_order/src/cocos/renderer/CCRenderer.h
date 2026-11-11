#pragma once

#include <string>
#include <vector>

namespace cocos2d {
class Renderer {
public:
    void addCommand(const std::string& nodeName, float globalZOrder);
    void render();

private:
    struct Command {
        std::string nodeName;
        float globalZOrder;
        unsigned int arrival;
    };
    unsigned int _nextArrival = 0;
    std::vector<Command> _globalNegative;
    std::vector<Command> _globalZero;
    std::vector<Command> _globalPositive;
};
}
