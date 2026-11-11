#include "cocos/renderer/CCPass.h"

#include <iostream>

int main() {
    GLProgram program;
    program.link("u_opacity", 2);

    GLProgramState state(program);
    state.setUniformFloat("u_opacity", 0.65f);
    std::cout << "no GL uniform call before Pass::bind\n";

    Pass pass(state);
    pass.bind();
}
