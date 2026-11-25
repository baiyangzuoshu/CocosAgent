#pragma once

#include <glad/glad.h>

namespace lesson {

enum class FailureMode {
    None,
    Compile,
    Link,
};

bool parseFailureMode(int argc, char** argv, FailureMode* failureMode);
GLuint createProgram(FailureMode failureMode);

} // namespace lesson
