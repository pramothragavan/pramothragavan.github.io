# assets/ramsey.py

import matplotlib.pyplot as plt
import networkx as nx
import random
from io import BytesIO

def generate_ramsey_image(N, k, l, col1 = "blue", col2 = "red"):
    G_blue = nx.Graph()
    G_red  = nx.Graph()
    nodes = list(range(N))
    G_blue.add_nodes_from(nodes)
    G_red.add_nodes_from(nodes)

    for i in range(N):
        for j in range(i + 1, N):
            if random.random() < 0.5:
                G_blue.add_edge(i, j)
            else:
                G_red.add_edge(i, j)


    def find_clique(G, size):
        for clique in nx.find_cliques(G):
            if len(clique) >= size:
                return clique[:size]
        return None

    blue_clique = find_clique(G_blue, k)
    red_clique  = find_clique(G_red, l)

    fig = plt.figure(figsize=(5, 5), dpi=150, facecolor="none")
    ax  = fig.add_subplot(1, 1, 1, facecolor="none")

    pos = nx.circular_layout(nodes)
    nx.draw(
        G_blue, pos,
        ax=ax,
        edge_color=col1,
        alpha=0.4,
        node_color='white',
        edgecolors='black',
        linewidths=0.5
    )
    nx.draw(
        G_red, pos,
        ax=ax,
        edge_color=col2,
        alpha=0.4,
        node_color='white',
        edgecolors='black',
        linewidths=0.5
    )

    status = "No monochromatic clique found."
    if blue_clique:
        H = G_blue.subgraph(blue_clique)
        nx.draw_networkx_nodes(H, pos, ax=ax, node_color=col1, node_size=300)
        nx.draw_networkx_edges(H, pos, ax=ax, edge_color=col1, width=3)
        status = f"Found a blue {k}-set!" if col1 == "blue" else f"Found a pink {k}-set!"
    elif red_clique:
        H = G_red.subgraph(red_clique)
        nx.draw_networkx_nodes(H, pos, ax=ax, node_color=col2, node_size=300)
        nx.draw_networkx_edges(H, pos, ax=ax, edge_color=col2, width=3)
        status = f"Found a red {l}-set!" if col2 == "red" else f"Found a purple {l}-set!"

    ax.set_axis_off()
    buf = BytesIO()
    fig.savefig(
        buf,
        format='svg',
        bbox_inches='tight',
        pad_inches=0,
        transparent=True
    )
    plt.close(fig)
    buf.seek(0)

    svg_text = buf.read().decode('utf-8')
    return {"status": status, "svg": svg_text}
