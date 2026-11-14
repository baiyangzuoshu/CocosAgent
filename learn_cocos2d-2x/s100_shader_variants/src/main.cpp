
#include <algorithm>
#include <array>
#include <cstring>
#include <iostream>
#include <map>
#include <string>
#include <vector>
#include "cocos2dx/shaders/ShaderLesson.h"
int main(){CCShaderCache cache;std::map<std::string,int> red{{"USE_TINT",1}},plain{{"USE_TINT",0}};std::string a=cache.get("sprite",red);std::string b=cache.get("sprite",plain);std::string again=cache.get("sprite",red);std::cout<<"variant ids "<<a<<", "<<b<<", repeated="<<again<<"; cache size="<<cache.size()<<"\nOpenGL ES 1.x/2.0 platform shader precision must be checked at runtime\n";}
