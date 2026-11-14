#pragma once
class CCGLProgram { public: void use(){std::cout<<"CC_NODE_DRAW_SETUP -> CCGLProgram::use\n";} void setUniform(){std::cout<<"set u_tint and sampler uniforms\n";} };
class CCSprite { public: void draw(CCGLProgram& p){std::cout<<"CCSprite::draw bind vertex/color/uv arrays\n";p.use();p.setUniform();std::cout<<"glDrawArrays(GL_TRIANGLE_STRIP) now\n";} };
