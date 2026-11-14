#pragma once
class CCGLProgram { public: int getUniformLocationForName(const std::string& name){std::cout<<"uniform location "<<name<<" = 3\n";return 3;} void setUniformLocationWith4f(int loc,float r,float g,float b,float a){std::cout<<"glUniform4f("<<loc<<", "<<r<<", "<<g<<", "<<b<<", "<<a<<")\n";} };
