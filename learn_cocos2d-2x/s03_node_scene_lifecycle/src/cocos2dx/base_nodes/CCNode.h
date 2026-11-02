#pragma once

#include <vector>

namespace cocos2d {

class CCNode {
public:
    explicit CCNode(int tag = 0);
    virtual ~CCNode();
    void addChild(CCNode* child);
    virtual void onEnter();
    virtual void onExit();
    void setTag(int tag);
    int getTag() const;
    CCNode* getParent() const;
    const std::vector<CCNode*>& getChildren() const;

protected:
    void setParent(CCNode* parent);
    int _tag;
    bool _running;

private:
    CCNode* _parent;
    std::vector<CCNode*> _children;
};

} // namespace cocos2d
