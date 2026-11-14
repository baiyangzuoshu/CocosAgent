
#include <algorithm>
#include <array>
#include <cstring>
#include <iostream>
#include <map>
#include <string>
#include <vector>
#include "cocos/2d/SpriteShaderLesson.h"
int main(){backend::ShaderModuleGL shader;shader.compile();Material material;backend::CommandBuffer buffer;Sprite sprite;sprite.draw(material,buffer);std::cout<<"Metal follows ShaderModuleMTL.mm, not ShaderModuleGL\n";}
