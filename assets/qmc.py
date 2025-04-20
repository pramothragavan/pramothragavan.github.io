# assets/qmc.py

import numpy as np

def dephasing(rho):
    projectors = [
        np.array([[1, 0], [0, 0]]),  # |0⟩⟨0|
        np.array([[0, 0], [0, 1]])   # |1⟩⟨1|
    ]
    return sum(P @ rho @ P for P in projectors)

def simulate_qmc(steps, alpha, beta, p):
    plus = np.array([1, 1]) / np.sqrt(2)
    minus = np.array([1, -1]) / np.sqrt(2)

    F = np.array([[alpha, beta],
                  [1 - alpha, 1 - beta]])

    K_plus  = np.outer(np.array([1, 0]), plus.conj())
    K_minus = np.outer(np.array([0, 1]), minus.conj())

    def E_ij(rho, i, j, p):
        meas = K_plus @ rho @ K_plus.conj().T if i == 0 else K_minus @ rho @ K_minus.conj().T
        return (1 - p) * meas + p * F[i, j] * dephasing(rho)

    rho1 = np.outer(plus, plus.conj())
    rho2 = np.zeros((2, 2), dtype=complex)
    S = [rho1.copy(), rho2.copy()]
    
    probs1 = [np.trace(S[0]).real]

    for _ in range(steps):
        newS = [np.zeros((2, 2), complex), np.zeros((2, 2), complex)]
        for i in [0, 1]:
            for j in [0, 1]:
                newS[i] += E_ij(S[j], i, j, p)
        S = newS
        probs1.append(np.trace(S[0]).real)

    return {
        "probs": probs1
    }
