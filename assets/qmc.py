# assets/qmc.py

import numpy as np

def identity(rho):
    return rho

def partial_dephase(rho, p):
    diag_rho = np.diag(np.diag(rho))
    return (1 - p) * rho + p * diag_rho

def build_tom(lam1, lam2, p):
    def E11(rho): return lam1 * identity(rho)
    def E21(rho): return (1 - lam1) * partial_dephase(rho, p)
    def E12(rho): return lam2 * identity(rho)
    def E22(rho): return (1 - lam2) * partial_dephase(rho, p)
    return [[E11, E12], [E21, E22]]

def evolve_state(S, TOM):
    new_S = []
    for i in range(2):
        new_rho = np.zeros((2, 2), dtype=complex)
        for j in range(2):
            new_rho += TOM[i][j](S[j])
        new_S.append(new_rho)
    return new_S

def initial_state():
    psi0 = np.array([[1, 0], [0, 0]], dtype=complex)
    psi_plus = np.array([[0.5, 0.5], [0.5, 0.5]], dtype=complex)
    S1 = 0.6 * psi0
    S2 = 0.4 * psi_plus
    return [S1, S2]

def coherence_measure(rho):
    off_diag = rho.copy()
    np.fill_diagonal(off_diag, 0)
    return np.sum(np.abs(off_diag))

def simulate_qmc(steps=50, lam1=0.7, lam2=0.8, p=0.5):
    TOM = build_tom(lam1, lam2, p)
    S = initial_state()
    probs = []
    coherences = []
    for _ in range(steps):
        p1 = np.trace(S[0]).real
        p2 = np.trace(S[1]).real
        probs.append([p1, p2])
        c1 = coherence_measure(S[0])
        c2 = coherence_measure(S[1])
        coherences.append([c1, c2])
        S = evolve_state(S, TOM)
    return {
        "probs": probs,
        "coherences": coherences
    }
