
#include <algorithm>
#include <array>
#include <cstring>
#include <iostream>
#include <map>
#include <string>
#include <vector>
#include "cocos/2d/SpriteShaderLesson.h"
int main(){GLProgramState state;TrianglesCommand command(state);Renderer renderer;Sprite sprite;sprite.draw(renderer,command);renderer.render();}
