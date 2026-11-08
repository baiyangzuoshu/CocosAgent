#include <stdio.h>

#include "score.h"

int main(void)
{
    int hit_count = 3;
    int points_per_hit = 15;
    int score = calculate_score(hit_count, points_per_hit);
    char rank = rank_from_score(score);

    printf("hits: %d\n", hit_count);
    printf("score: %d\n", score);
    printf("rank: %c\n", rank);

    return 0;
}
