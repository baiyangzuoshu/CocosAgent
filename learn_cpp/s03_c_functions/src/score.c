#include "score.h"

int calculate_score(int hit_count, int points_per_hit)
{
    int score = 0;

    for (int hit = 0; hit < hit_count; ++hit) {
        score += points_per_hit;
    }

    return score;
}

char rank_from_score(int score)
{
    if (score >= 45) {
        return 'A';
    }
    if (score >= 30) {
        return 'B';
    }
    return 'C';
}
