
#include <algorithm>
#include <array>
#include <cstring>
#include <iostream>
#include <map>
#include <string>
#include <vector>
#include "cocos/renderer/backend/ShaderLesson.h"
int main(){describeBlend();Rgba background{0.1f,0.1f,0.1f,1.0f};Rgba straight{1.0f,0.25f,0.1f,0.5f};Rgba a=blendStraight(straight,background);Rgba b=blendPremultiplied(premultiply(straight),background);std::cout<<"straight rgb="<<a.r<<","<<a.g<<","<<a.b<<"\n";std::cout<<"premult rgb="<<b.r<<","<<b.g<<","<<b.b<<"\n";}
