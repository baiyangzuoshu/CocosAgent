#include <stddef.h>
#include <stdio.h>

int main(void)
{
    int scores[] = {12, 18, 15};
    size_t score_count = sizeof(scores) / sizeof(scores[0]);
    int total = 0;

    printf("scores:");
    for (size_t i = 0; i < score_count; ++i) {
        printf(" %d", scores[i]);
        total += scores[i];
    }
    printf("\ntotal: %d\n", total);

    char title[12] = "C arrays";
    size_t title_length = 0;
    while (title[title_length] != '\0') {
        ++title_length;
    }

    printf("title: %s\n", title);
    printf("length: %zu\n", title_length);
    printf("capacity: %zu\n", sizeof(title));

    title[0] = 'c';
    printf("updated title: %s\n", title);

    return 0;
}
