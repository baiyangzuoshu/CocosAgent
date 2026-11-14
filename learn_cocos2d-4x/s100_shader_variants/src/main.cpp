
#include <algorithm>
#include <array>
#include <cstring>
#include <iostream>
#include <map>
#include <string>
#include <vector>
#include "cocos/renderer/backend/ShaderLesson.h"
int main(){ProgramCache cache;std::map<std::string,int> red{{"USE_TINT",1}},plain{{"USE_TINT",0}};std::string a=cache.get("sprite",red);std::string b=cache.get("sprite",plain);std::string again=cache.get("sprite",red);std::cout<<"variant ids "<<a<<", "<<b<<", repeated="<<again<<"; cache size="<<cache.size()<<"\nProgram cache key is backend-aware; OpenGL and Metal compile through different ShaderModule\n";}
