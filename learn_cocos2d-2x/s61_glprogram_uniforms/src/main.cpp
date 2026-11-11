#include "cocos2dx/shaders/CCShaderCache.h"

int main() {
    CCShaderCache cache;
    cache.loadDefaultShaders();

    CCGLProgram* program = cache.programForKey("sprite-tint");
    if (!program) return 1;
    program->use();
    const int tint = program->getUniformLocationForName("u_tint");
    program->setUniformLocationWith4f(tint, 0.3f, 0.8f, 1.0f, 1.0f);
}
