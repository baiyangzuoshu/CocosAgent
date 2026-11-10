#include <functional>
#include <iostream>
#include <string>
#include <utility>
#include <vector>

class Button
{
public:
    Button(std::string label, double height, std::function<void()> onClick)
        : label_(std::move(label)), height_(height), onClick_(std::move(onClick)) {}
    const std::string& label() const { return label_; }
    double height() const { return height_; }
    void setY(double y) { y_ = y; }
    double y() const { return y_; }
    void click() const { onClick_(); }
private:
    std::string label_;
    double height_;
    double y_{0.0};
    std::function<void()> onClick_;
};
class VerticalLayout
{
public:
    VerticalLayout(double height, double top, double bottom, double spacing)
        : height_(height), top_(top), bottom_(bottom), spacing_(spacing) {}
    void add(Button& button) { widgets_.push_back(&button); }
    void forceDoLayout()
    {
        double cursor = height_ / 2.0 - top_;
        for (auto* widget : widgets_)
        {
            cursor -= widget->height() / 2.0;
            widget->setY(cursor);
            cursor -= widget->height() / 2.0 + spacing_;
        }
    }
    double bottomMargin() const
    {
        if (widgets_.empty())
            return height_ / 2.0;
        const auto* last = widgets_.back();
        return last->y() - last->height() / 2.0 + height_ / 2.0;
    }
    double configuredBottomMargin() const { return bottom_; }
private:
    double height_;
    double top_;
    double bottom_;
    double spacing_;
    std::vector<Button*> widgets_;
};
int main()
{
    Button start("Start", 24.0, [] { std::cout << "Start clicked\n"; });
    Button settings("Settings", 32.0, [] { std::cout << "Settings clicked\n"; });
    Button quit("Quit", 24.0, [] { std::cout << "Quit clicked\n"; });
    VerticalLayout menu(116.0, 10.0, 10.0, 8.0);
    menu.add(start);
    menu.add(settings);
    menu.add(quit);
    menu.forceDoLayout();
    std::cout << "Start y=" << start.y() << '\n'
              << "Settings y=" << settings.y() << '\n'
              << "Quit y=" << quit.y() << '\n'
              << "actual bottom margin=" << menu.bottomMargin()
              << ", configured=" << menu.configuredBottomMargin() << '\n';
    settings.click();
}
