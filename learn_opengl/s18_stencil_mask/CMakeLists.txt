cmake_minimum_required(VERSION 3.20)
project(learn_opengl_s18_stencil_mask LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

find_package(OpenGL REQUIRED)
find_package(glfw3 CONFIG REQUIRED)
find_package(glad CONFIG REQUIRED)

if (TARGET glfw)
    set(LEARN_OPENGL_GLFW_TARGET glfw)
elseif (TARGET glfw3::glfw)
    set(LEARN_OPENGL_GLFW_TARGET glfw3::glfw)
else()
    message(FATAL_ERROR "GLFW package was found but did not define a supported target")
endif()

if (TARGET glad::glad)
    set(LEARN_OPENGL_GLAD_TARGET glad::glad)
elseif (TARGET glad)
    set(LEARN_OPENGL_GLAD_TARGET glad)
else()
    message(FATAL_ERROR "GLAD package was found but did not define a supported target")
endif()

add_executable(learn_opengl_s18_stencil_mask src/main.cpp)
target_link_libraries(learn_opengl_s18_stencil_mask
    PRIVATE
        OpenGL::GL
        ${LEARN_OPENGL_GLFW_TARGET}
        ${LEARN_OPENGL_GLAD_TARGET}
)
