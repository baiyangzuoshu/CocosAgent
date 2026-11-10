#pragma once
#include <string>
namespace cocos2d {
struct Size {
  float width; float height;
  Size(float w = 0, float h = 0) : width(w), height(h) {}
};
class Label {
 public:
  void setString(const std::string& text);
  const std::string& getString() const { return _utf8Text; }
  Size getContentSize() const;
  bool isContentDirty() const { return _contentDirty; }
  void visit();
 private:
  void updateContent();
  std::string _utf8Text;
  Size _contentSize;
  bool _contentDirty = false;
  unsigned int _contentRevision = 0;
};
}
