#include <stdio.h>

typedef struct Node {
    const char *name;
    struct Node *first_child;
    struct Node *next_sibling;
} Node;

void print_tree(const Node *node, int depth)
{
    if (node == NULL) {
        return;
    }

    for (int i = 0; i < depth; ++i) {
        printf("  ");
    }
    puts(node->name);

    print_tree(node->first_child, depth + 1);
    print_tree(node->next_sibling, depth);
}

int main(void)
{
    Node hero = {"Hero", NULL, NULL};
    Node actors = {"Actors", &hero, NULL};
    Node ui = {"UI", NULL, NULL};
    Node scene = {"Scene", &actors, NULL};

    actors.next_sibling = &ui;

    print_tree(&scene, 0);
    return 0;
}
