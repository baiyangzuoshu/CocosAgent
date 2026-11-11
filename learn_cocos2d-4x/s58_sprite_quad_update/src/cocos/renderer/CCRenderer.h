#pragma once

#include "CCTrianglesCommand.h"

namespace cocos2d {

class Renderer {
public:
    void addCommand(TrianglesCommand* command);
    void render() const;

private:
    TrianglesCommand* m_command = nullptr;
};

} // namespace cocos2d
