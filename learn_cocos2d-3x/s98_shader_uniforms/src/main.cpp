
#include <algorithm>
#include <array>
#include <cstring>
#include <iostream>
#include <map>
#include <string>
#include <vector>
#include "cocos/renderer/ShaderLesson.h"
int main(){GLProgramState state;state.setUniformVec4("u_tint",{0.25f,0.65f,1.0f,1.0f});std::cout<<"No GL write until the Pass binds\n";Pass pass(state);pass.bind();}
