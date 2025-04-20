# assets/qwalk.py

import numpy as np
from scipy.sparse import lil_matrix, kron

def create_sparse_E(n, i, j):
    E = lil_matrix((n, n), dtype=np.complex128)
    E[i, j] = 1.0
    return E.tocsr()

def simulate_qwalk(p=0.75, theta0=0.8976, theta1=1.0472, N=50, T=50):
    d_pos = 2 * N + 1
    d_coin = 2

    c0, s0 = np.cos(theta0), np.sin(theta0)
    c1, s1 = np.cos(theta1), np.sin(theta1)

    P = np.array([[0, c0], [s0 * s1, -s0 * c1]], dtype=np.complex128)
    Q = np.array([[s0 * c1, s0 * s1], [c0, 0]], dtype=np.complex128)

    indices = np.arange(-N, N+1)
    Kraus_ops = []

    left_mask = (indices > -N)
    left_E = [create_sparse_E(d_pos, i+N-1, i+N) for i in indices[left_mask]]
    Kraus_ops.extend([kron(E, P, format='csr') for E in left_E])

    right_mask = (indices < N)
    right_E = [create_sparse_E(d_pos, i+N+1, i+N) for i in indices[right_mask]]
    Kraus_ops.extend([kron(E, Q, format='csr') for E in right_E])

    rho_coin = np.array([[p, 0], [0, 1 - p]], dtype=np.complex128)
    rho_pos = lil_matrix((d_pos, d_pos), dtype=np.complex128)
    rho_pos[N, N] = 1.0
    rho = kron(rho_pos.tocsr(), rho_coin)

    prob_distributions = np.zeros((T+1, d_pos), dtype=np.float64)

    for t in range(T+1):
        prob_distributions[t] = rho.diagonal().real.reshape(d_pos, d_coin).sum(axis=1)
        if t < T:
            rho = sum(K @ rho @ K.conj().T for K in Kraus_ops).tocsr()

    return {
        "position": np.arange(-N, N+1).tolist(),
        "final_probs": prob_distributions[-1].tolist()
    }
