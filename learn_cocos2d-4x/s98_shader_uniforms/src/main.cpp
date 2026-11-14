
#include <algorithm>
#include <array>
#include <cstring>
#include <iostream>
#include <map>
#include <string>
#include <vector>
#include "cocos/renderer/backend/ShaderLesson.h"
int main(){backend::ProgramState state({0});const float tint[4]={0.25f,0.65f,1.0f,1.0f};state.setUniform(tint);std::cout<<"read fragment buffer u_tint.r="<<state.read(0)<<"\n";}
