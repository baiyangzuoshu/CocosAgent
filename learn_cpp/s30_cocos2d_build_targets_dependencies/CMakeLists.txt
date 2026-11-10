cmake_minimum_required(VERSION 3.16)
project(cocos_target_graph_demo LANGUAGES CXX)

add_library(engine_core src/engine.cpp)
target_compile_features(engine_core PUBLIC cxx_std_17)

add_executable(game src/main.cpp)
target_link_libraries(game PRIVATE engine_core)
