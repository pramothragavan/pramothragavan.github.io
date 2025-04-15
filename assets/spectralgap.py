import numpy as np

def vec(rho):
    return rho.flatten('F')

def unvec(v):
    return v.reshape((2, 2), order='F')

def basis_matrices():
    E = []
    for i in range(2):
        for j in range(2):
            E_ij = np.zeros((2,2), dtype=complex)
            E_ij[i, j] = 1
            E.append(E_ij)
    return E

def superoperator_matrix(channel, basis):
    dim = len(basis)
    M = np.zeros((dim, dim), dtype=complex)
    for i in range(dim):
        col = vec(channel(basis[i]))
        M[:, i] = col
    return M

def identity(rho):
    return rho

def partial_dephase(rho, p):
    diag_rho = np.diag(np.diag(rho))
    return (1-p)*rho + p*diag_rho

def identity_superoperator():
    basis = basis_matrices()
    return superoperator_matrix(identity, basis)

def dephasing_superoperator(p):
    basis = basis_matrices()
    channel = lambda rho: partial_dephase(rho, p)
    return superoperator_matrix(channel, basis)

def build_TOM_superoperator(lam1, lam2, p):
    I4 = identity_superoperator()
    D4 = dephasing_superoperator(p)
    M11 = lam1 * I4
    M21 = (1 - lam1) * D4

    M12 = lam2 * I4
    M22 = (1 - lam2) * D4
    top_block = np.hstack((M11, M12))
    bottom_block = np.hstack((M21, M22))
    M = np.vstack((top_block, bottom_block))
    return M

def spectral_gap(M):
    eigvals = np.linalg.eigvals(M)
    epsilon = 1e-6
    other_eigs = [abs(ev) for ev in eigvals if not np.isclose(ev, 1, atol=epsilon)]
    if len(other_eigs) == 0:
        return 0.0
    return 1 - max(other_eigs)


p_values = np.linspace(0, 1, 21)

lam1_values = [0.5, 0.7, 0.9]
lam2_fixed = 0.8

lam2_values = [0.5, 0.8, 1.0]
lam1_fixed = 0.7

def simulate(lam1=0.7, lam2=0.8):
    gaps = []
    for p in p_values:
        M = build_TOM_superoperator(lam1, lam2, p)
        gaps.append(spectral_gap(M))
    return {"gaps": gaps}