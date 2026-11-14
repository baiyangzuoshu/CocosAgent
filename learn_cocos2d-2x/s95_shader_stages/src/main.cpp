
#include <algorithm>
#include <array>
#include <cstring>
#include <iostream>
#include <map>
#include <string>
#include <vector>
#include "cocos2dx/shaders/ShaderLesson.h"
int main(){
 const std::string vertex = "attribute vec4 a_position;\nvoid main(){ gl_Position = a_position; }";
 const std::string fragment = "precision mediump float;\nvoid main(){ gl_FragColor = vec4(0.2,0.7,1.0,1.0); }";
 CCShaderCache cache; CCGLProgram& p=cache.addProgram("sprite-basic"); return p.compile("vertex",vertex)&&p.compile("fragment",fragment)&&p.link()?0:1; }
