#include "cocos/renderer/backend/ProgramCache.h"
#include "cocos/renderer/backend/ProgramState.h"

#include <array>
#include <iostream>

int main() {
    backend::ProgramCache cache;
    backend::Program& program = cache.getBuiltinProgram("sprite");
    backend::ProgramState state(program);

    const backend::UniformLocation tint = program.getUniformLocation("u_tint");
    const std::array<float, 4> value = {0.25f, 0.5f, 0.9f, 1.0f};
    state.setUniform(tint, value.data(), sizeof(value));

    std::cout << "CPU uniform buffer first value = " << state.readFirstFloat(tint) << "\n";
    std::cout << "No backend draw command submitted in this lesson\n";
}
