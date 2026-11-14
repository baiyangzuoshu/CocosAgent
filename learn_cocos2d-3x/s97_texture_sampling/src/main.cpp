
#include <algorithm>
#include <array>
#include <cstring>
#include <iostream>
#include <map>
#include <string>
#include <vector>
#include "cocos/renderer/ShaderLesson.h"
int main(){
 UV a{0,0},b{1,0},c{0,1}; UV uv=Texture2D::interpolate(a,b,c,0.25f,0.25f,0.5f);
 Texture2D texture; printSample(uv,texture.sampleNearest(uv));
 std::cout<<"fragment operation: "<<Texture2D::fragmentOperation()<<"\n3.x sample uses varying v_texCoord and texture2D(CC_Texture0, v_texCoord)\n";
}
