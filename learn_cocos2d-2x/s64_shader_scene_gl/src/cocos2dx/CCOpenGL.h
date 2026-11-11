#pragma once

#include <iostream>

inline void ccGLBindTexture2D(unsigned int texture) {
    std::cout << "ccGLBindTexture2D(" << texture << ")\n";
}
inline void glVertexAttribPointer(const char* attribute) {
    std::cout << "glVertexAttribPointer(" << attribute << ")\n";
}
inline void glDrawArrays() { std::cout << "glDrawArrays(GL_TRIANGLE_STRIP, 0, 4)\n"; }
inline void ccGLBlendFunc() { std::cout << "ccGLBlendFunc\n"; }
