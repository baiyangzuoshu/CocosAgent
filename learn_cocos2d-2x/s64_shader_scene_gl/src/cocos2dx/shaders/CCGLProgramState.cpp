#include "CCGLProgramState.h"

#include <iostream>

void CCGLProgramState::apply(const char* nodeName) const {
    std::cout << "CC_NODE_DRAW_SETUP: apply GLProgramState for " << nodeName << "\n";
}
