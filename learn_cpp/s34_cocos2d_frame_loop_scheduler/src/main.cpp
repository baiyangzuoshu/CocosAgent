#include <functional>
#include <iostream>
#include <string>
#include <utility>
#include <vector>

class Scheduler
{
public:
    void schedule(std::string name, double interval, std::function<void()> callback)
    {
        entries_.push_back({std::move(name), interval, 0.0, std::move(callback)});
    }

    void update(double deltaTime)
    {
        for (auto& entry : entries_)
        {
            entry.elapsed += deltaTime;
            while (entry.elapsed >= entry.interval)
            {
                entry.elapsed -= entry.interval;
                entry.callback();
            }
        }
    }

private:
    struct Entry
    {
        std::string name;
        double interval;
        double elapsed;
        std::function<void()> callback;
    };
    std::vector<Entry> entries_;
};

class Director
{
public:
    void mainLoop(double deltaTime)
    {
        std::cout << "poll events\n";
        scheduler_.update(deltaTime);
        std::cout << "update scene\n";
        std::cout << "visit and render\n";
        std::cout << "clear autorelease pool\n";
    }

    Scheduler& scheduler() { return scheduler_; }

private:
    Scheduler scheduler_;
};

int main()
{
    Director director;
    int ticks = 0;
    director.scheduler().schedule("half-second timer", 0.5, [&ticks]() {
        std::cout << "scheduled callback " << ++ticks << '\n';
    });

    for (int frame = 1; frame <= 3; ++frame)
    {
        std::cout << "frame " << frame << '\n';
        director.mainLoop(0.25);
    }
}
