
#include <algorithm>
#include <array>
#include <cstring>
#include <iostream>
#include <map>
#include <string>
#include <vector>
#include "cocos/renderer/ShaderLesson.h"
int main(){GLProgramCache cache;std::map<std::string,int> red{{"USE_TINT",1}},plain{{"USE_TINT",0}};std::string a=cache.get("sprite",red);std::string b=cache.get("sprite",plain);std::string again=cache.get("sprite",red);std::cout<<"variant ids "<<a<<", "<<b<<", repeated="<<again<<"; cache size="<<cache.size()<<"\nGLProgramCache chooses source defines; GLES profile affects precision/extensions\n";}
