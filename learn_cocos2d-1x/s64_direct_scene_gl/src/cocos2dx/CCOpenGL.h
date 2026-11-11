#pragma once

#include <iostream>

inline void glBindTexture(unsigned int, unsigned int texture) {
    std::cout << "glBindTexture(" << texture << ")\n";
}
inline void glVertexPointer() { std::cout << "glVertexPointer\n"; }
inline void glColorPointer() { std::cout << "glColorPointer\n"; }
inline void glTexCoordPointer() { std::cout << "glTexCoordPointer\n"; }
inline void glDrawArrays() { std::cout << "glDrawArrays(GL_TRIANGLE_STRIP, 0, 4)\n"; }

constexpr unsigned int GL_TEXTURE_2D = 0x0DE1;
