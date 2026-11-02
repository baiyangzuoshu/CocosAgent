#pragma once

#include "cocos2dx/include/CCObject.h"

#include <string>
#include <vector>

namespace cocos2d {

class CCNode : public CCObject {
public:
    static CCNode* node();
    void addChild(CCNode* child);
    void removeChild(CCNode* child);
    CCNode* getParent() const;
    const std::vector<CCNode*>& getChildren() const;
    void setTag(int tag);
    int getTag() const;


protected:
    CCNode();
    ~CCNode() override;

private:
    void setParent(CCNode* parent);
    CCNode* _parent;
    std::vector<CCNode*> _children;
    int _tag;

};

} // namespace cocos2d
