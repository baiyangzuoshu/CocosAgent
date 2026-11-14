
#include <algorithm>
#include <array>
#include <cstring>
#include <iostream>
#include <map>
#include <string>
#include <vector>
#include "cocos2dx/shaders/ShaderLesson.h"
int main(){CCGLProgram program;int loc=program.getUniformLocationForName("u_tint");program.setUniformLocationWith4f(loc,0.25f,0.65f,1.0f,1.0f);}
