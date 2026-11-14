
#include <algorithm>
#include <array>
#include <cstring>
#include <iostream>
#include <map>
#include <string>
#include <vector>
#include "cocos/renderer/backend/ShaderLesson.h"
int main(){
 VertexInput::bindAttributes();
 Vertex v{-0.5f,-0.5f,0.0f,1.0f,0.25f,0.75f,1.0f,1.0f};
 std::array<float,16> m{1,0,0,0, 0,1,0,0, 0,0,1,0, 0.2f,0.1f,0,1};
 ClipPosition p=transformPosition(v,m); VertexInput::trace(v,p);
 std::cout<<"Version path: ProgramState/InputAssembler associates attributes with backend Program\n";
}
