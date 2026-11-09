#include <iostream>
#include <vector>

class ScoreList {
public:
    explicit ScoreList(const std::vector<int>& scores)
        : scores_{scores}
    {
    }

    void append(int score)
    {
        scores_.push_back(score);
    }

    void print(const char* label) const
    {
        std::cout << label << ':';
        for (int score : scores_) {
            std::cout << ' ' << score;
        }
        std::cout << '\n';
    }

private:
    std::vector<int> scores_;
};

int main()
{
    const std::vector<int> initial_scores{10, 20};
    ScoreList source{initial_scores};

    ScoreList copied{source};

    ScoreList assigned{initial_scores};
    assigned = source;

    source.append(30);

    source.print("source");
    copied.print("copy constructed");
    assigned.print("copy assigned");

    return 0;
}
