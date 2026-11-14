
#include <algorithm>
#include <array>
#include <cstring>
#include <iostream>
#include <map>
#include <string>
#include <vector>
#include "cocos/renderer/ShaderLesson.h"
int main(){
 const std::string vertex = "attribute vec4 a_position;\nvoid main(){ gl_Position = a_position; }";
 const std::string fragment = "precision mediump float;\nvoid main(){ gl_FragColor = vec4(0.2,0.7,1.0,1.0); }";
 GLProgramCache cache; GLProgram& p=cache.get("sprite-basic"); return p.compileShader("vertex",vertex)&&p.compileShader("fragment",fragment)&&p.link()?0:1; }
