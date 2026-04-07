#!/usr/bin/env python3
"""
Markov Transition Matrix from K=9 Clustered Data

Computes row-normalized transition probabilities, stationary distribution,
key corridors, and forbidden jumps.
"""

import json
import pathlib
import numpy as np
import pandas as pd

TRADING_DIR = pathlib.Path(__file__).resolve().parent.parent
DATA_DIR = TRADING_DIR / "data"

# Load archetype labels from topology file
def load_archetypes():
    with open(DATA_DIR / "topology_9basin.json") as f:
        topo = json.load(f)
    names = {}
    for cid, info in topo["clusters"].items():
        sign = info.get("sign", "")
        label = info.get("label", f"C{cid}")
        archetype = info.get("archetype", "")
        short = f"{label}{sign}"
        names[int(cid)] = {"short": short, "full": archetype, "sign": sign}
    return names, topo


def main():
    df = pd.read_parquet(DATA_DIR / "features_6d_clustered.parquet")
    names, topo = load_archetypes()
    print(f"Loaded {len(df)} rows, {df['token'].nunique()} tokens\n")

    # ── Step 1: Raw transition counts ────────────────────────────────
    print("=" * 80)
    print("Step 1: Raw Transition Counts")
    print("=" * 80)

    counts = np.zeros((9, 9), dtype=int)
    for token in sorted(df["token"].unique()):
        sub = df[df["token"] == token].sort_values("timestamp")
        cl = sub["cluster"].values
        for i in range(len(cl) - 1):
            counts[cl[i], cl[i + 1]] += 1

    total_transitions = counts.sum()
    print(f"  Total transitions: {total_transitions:,}")

    # Print raw count matrix
    hdr = "        |" + "|".join(f" {names[j]['short']:>7} " for j in range(9)) + "|"
    print(hdr)
    print("-" * len(hdr))
    for i in range(9):
        row = f" {names[i]['short']:>6} |" + "|".join(f" {counts[i,j]:>7} " for j in range(9)) + "|"
        print(row)

    # ── Step 2: Row-normalize ────────────────────────────────────────
    print("\n" + "=" * 80)
    print("Step 2+3: Transition Probability Matrix P(j | i)")
    print("=" * 80)

    row_sums = counts.sum(axis=1, keepdims=True).astype(float)
    row_sums[row_sums == 0] = 1
    P = counts / row_sums

    hdr = "        |" + "|".join(f" {names[j]['short']:>7} " for j in range(9)) + "| row_sum"
    print(hdr)
    print("-" * len(hdr))
    for i in range(9):
        row = f" {names[i]['short']:>6} |" + "|".join(f"  {P[i,j]:>.3f}  " for j in range(9)) + f"| {P[i].sum():.3f}"
        print(row)

    # ── Step 4: Key statistics ───────────────────────────────────────
    print("\n" + "=" * 80)
    print("Step 4a: Self-Transition (Stickiness)")
    print("=" * 80)

    diag = [(i, P[i, i]) for i in range(9)]
    diag.sort(key=lambda x: x[1], reverse=True)
    print(f"{'Cluster':>10} | {'P(stay)':>8} | Interpretation")
    print("-" * 55)
    for i, p in diag:
        interp = "very sticky" if p > 0.85 else "sticky" if p > 0.80 else "moderate" if p > 0.70 else "unstable"
        print(f" {names[i]['short']:>9} |  {p:.4f}  | {interp} ({names[i]['full']})")

    print("\n" + "=" * 80)
    print("Step 4b: Top 10 Off-Diagonal Corridors")
    print("=" * 80)

    off_diag = []
    for i in range(9):
        for j in range(9):
            if i != j:
                off_diag.append((i, j, P[i, j], counts[i, j]))
    off_diag.sort(key=lambda x: x[2], reverse=True)

    print(f"{'From':>10} → {'To':<10} | {'P':>6} | {'Count':>6}")
    print("-" * 45)
    for i, j, p, c in off_diag[:10]:
        print(f" {names[i]['short']:>9} → {names[j]['short']:<9} | {p:.4f} | {c:>6}")

    print("\n" + "=" * 80)
    print("Step 4c: Forbidden/Near-Zero Transitions (P < 0.001)")
    print("=" * 80)

    forbidden = [(i, j, P[i, j], counts[i, j]) for i, j, p, c in off_diag if p < 0.001]
    forbidden.sort(key=lambda x: x[2])
    print(f"  {len(forbidden)} transitions with P < 0.001:")
    for i, j, p, c in forbidden:
        print(f"    {names[i]['short']:>9} → {names[j]['short']:<9}: P={p:.5f} (count={c})")

    print("\n" + "=" * 80)
    print("Step 4d: Stationary Distribution")
    print("=" * 80)

    # Left eigenvector: pi @ P = pi, equivalently P^T @ pi = pi
    eigenvalues, eigenvectors = np.linalg.eig(P.T)
    # Find eigenvector for eigenvalue closest to 1
    idx = np.argmin(np.abs(eigenvalues - 1.0))
    pi = np.real(eigenvectors[:, idx])
    pi = pi / pi.sum()  # normalize to sum to 1

    # Compare with empirical occupancy
    empirical = df["cluster"].value_counts(normalize=True).sort_index()

    print(f"{'Cluster':>10} | {'Stationary':>10} | {'Empirical':>10} | {'Diff':>8}")
    print("-" * 50)
    for i in range(9):
        emp = empirical.get(i, 0)
        diff = pi[i] - emp
        print(f" {names[i]['short']:>9} | {pi[i]:>10.4f} | {emp:>10.4f} | {diff:>+8.4f}")
    print(f"\n  Max |diff|: {max(abs(pi[i] - empirical.get(i, 0)) for i in range(9)):.4f}")
    print(f"  Stationary sums to: {pi.sum():.6f}")

    # ── Save outputs ─────────────────────────────────────────────────
    transition_output = {
        "method": "row-normalized Markov from KMeans K=9",
        "total_transitions": int(total_transitions),
        "probability_matrix": {
            f"{i}->{j}": round(float(P[i, j]), 5) for i in range(9) for j in range(9)
        },
        "count_matrix": {
            f"{i}->{j}": int(counts[i, j]) for i in range(9) for j in range(9)
        },
        "self_transitions": {
            str(i): round(float(P[i, i]), 5) for i in range(9)
        },
        "stationary_distribution": {
            str(i): round(float(pi[i]), 5) for i in range(9)
        },
        "top_corridors": [
            {"from": int(i), "to": int(j), "prob": round(float(p), 5), "count": int(c)}
            for i, j, p, c in off_diag[:10]
        ],
        "forbidden_transitions": [
            {"from": int(i), "to": int(j), "prob": round(float(p), 6), "count": int(c)}
            for i, j, p, c in forbidden
        ],
    }

    with open(DATA_DIR / "transition_matrix.json", "w") as f:
        json.dump(transition_output, f, indent=2)
    print(f"\nSaved data/transition_matrix.json")

    # Update topology file
    topo["transition_matrix"] = transition_output["probability_matrix"]
    topo["stationary_distribution"] = transition_output["stationary_distribution"]
    topo["markov_stats"] = {
        "total_transitions": int(total_transitions),
        "top_corridors": transition_output["top_corridors"],
        "forbidden_count": len(forbidden),
    }
    with open(DATA_DIR / "topology_9basin.json", "w") as f:
        json.dump(topo, f, indent=2)
    print("Updated data/topology_9basin.json")
    print("\nDone.")


if __name__ == "__main__":
    main()
