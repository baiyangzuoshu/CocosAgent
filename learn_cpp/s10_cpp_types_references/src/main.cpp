#include <iostream>

void apply_bonus(int& score, int bonus)
{
    score += bonus;
}

void show_score(const int& score)
{
    std::cout << "read-only score: " << score << '\n';
}

int main()
{
    int score{45};
    const int bonus{5};
    double move_speed{2.5};
    int& score_ref{score};

    apply_bonus(score_ref, bonus);

    std::cout << "score: " << score << '\n';
    show_score(score);
    std::cout << "move speed: " << move_speed << '\n';

    return 0;
}
