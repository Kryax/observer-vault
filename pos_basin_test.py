#!/usr/bin/env python3
"""POS Density vs Basin Depth Correlation Test.

Tests whether noun-heavy text lands in deeper D/I/R basins than verb-heavy text.
Hypothesis: nouns are "frozen verbs" — stabilised D/I/R compositions with deep basins.

Embeds the full Langevin multi-well energy computation from energy-core.ts,
ported to Python for batch processing.
"""

import json
import math
import random
import time
from collections import defaultdict

import numpy as np
import spacy
from scipy import stats

# ── Config ──────────────────────────────────────────────────────────────────
DATA_PATH = "01-Projects/dir-engine/output/training_data_dir_v1.jsonl"
CENTROIDS_PATH = "01-Projects/dir-engine/data/centroids.json"
MOTIFS_PATH = "01-Projects/dir-engine/data/motifs.json"
WIDTHS_PATH = "01-Projects/dir-engine/data/basin-widths.json"
SAMPLE_SIZE_PER_COMP = 1111
SEED = 42

random.seed(SEED)
np.random.seed(SEED)

ALL_COMPOSITIONS = ["D(D)", "D(I)", "D(R)", "I(D)", "I(I)", "I(R)", "R(D)", "R(I)", "R(R)"]


# ── Energy Landscape (ported from energy-core.ts + energy.ts) ───────────────

def euclidean_distance(a, b):
    return math.sqrt(sum((ai - bi) ** 2 for ai, bi in zip(a, b)))


def shares_operator(a, b):
    if a == b:
        return False
    oA, iA = a[0], a[2]
    oB, iB = b[0], b[2]
    return oA == oB or iA == iB or oA == iB or iA == oB


# Build adjacency
DIR_ADJACENCY = {}
for a in ALL_COMPOSITIONS:
    DIR_ADJACENCY[a] = {b for b in ALL_COMPOSITIONS if shares_operator(a, b)}


def compute_basin_depths(motifs_data):
    comp_data = {}
    for m in motifs_data["motifs"]:
        c = m.get("composition", "")
        if c not in ALL_COMPOSITIONS:
            continue
        tier = m.get("tier", 0)
        domains = len(m.get("domains", []))
        existing = comp_data.get(c)
        if not existing or tier > existing[0] or (tier == existing[0] and domains > existing[1]):
            comp_data[c] = (tier, domains)

    depths = {}
    for comp in ALL_COMPOSITIONS:
        data = comp_data.get(comp)
        if data:
            tier_weight = 2.0 if data[0] == 2 else (1.0 if data[0] == 1 else 0.5)
            domain_scale = 1 + math.log(1 + data[1])
            depths[comp] = tier_weight * domain_scale
        else:
            depths[comp] = 0.5
    return depths


def compute_basin_widths(centroids, mapping, widths_data):
    """Compute basin widths: empirical scaled to match heuristic median."""
    n = len(centroids)

    # Heuristic: nn_distance / 6
    heuristic = []
    for i in range(n):
        min_dist = float("inf")
        for j in range(n):
            if i == j:
                continue
            d = euclidean_distance(centroids[i], centroids[j])
            if d < min_dist:
                min_dist = d
        heuristic.append(max(min_dist / 6, 0.01))

    # Empirical from basin-widths.json
    raw_empirical = []
    for i in range(n):
        comp = mapping[str(i)]
        emp = widths_data["widths"].get(comp)
        raw_empirical.append(emp if emp is not None else heuristic[i])

    # Scale empirical so median matches heuristic median
    sorted_emp = sorted(raw_empirical)
    sorted_heur = sorted(heuristic)
    mid = len(sorted_emp) // 2
    scale = sorted_heur[mid] / sorted_emp[mid] if sorted_emp[mid] > 0 else 1
    return [max(w * scale, 0.01) for w in raw_empirical]


def build_landscape(centroids_data, motifs_data, widths_data):
    depths = compute_basin_depths(motifs_data)
    widths = compute_basin_widths(
        centroids_data["centroids"],
        centroids_data["mapping"],
        widths_data,
    )
    basins = []
    for i, centroid in enumerate(centroids_data["centroids"]):
        comp = centroids_data["mapping"][str(i)]
        basins.append({
            "centroid": centroid,
            "depth": depths.get(comp, 0.5),
            "width": widths[i],
            "label": comp,
        })

    # Centre energy
    dim = len(centroids_data["centroids"][0])
    centre = [1 / math.sqrt(dim)] * dim
    centre_energy = compute_raw_energy(centre, basins)
    return {"basins": basins, "centre_energy": centre_energy}


def compute_raw_energy(x, basins):
    gaussian_sum = 0
    for b in basins:
        dist_sq = sum((xi - ci) ** 2 for xi, ci in zip(x, b["centroid"]))
        gaussian_sum += b["depth"] * math.exp(-dist_sq / (2 * b["width"] ** 2))
    return -gaussian_sum


def compute_raw_energy_directed(x, basins, from_b, to_b):
    eff_w = (from_b["width"] + to_b["width"]) / 2
    gaussian_sum = 0
    for b in basins:
        dist_sq = sum((xi - ci) ** 2 for xi, ci in zip(x, b["centroid"]))
        sigma = eff_w if (b is from_b or b is to_b) else b["width"]
        gaussian_sum += b["depth"] * math.exp(-dist_sq / (2 * sigma ** 2))
    return -gaussian_sum


def estimate_barrier(start, target, basins, from_b=None, to_b=None, samples=20):
    max_energy = -float("inf")
    for s in range(samples + 1):
        t = s / samples
        point = [v * (1 - t) + target[k] * t for k, v in enumerate(start)]
        if from_b and to_b:
            energy = compute_raw_energy_directed(point, basins, from_b, to_b)
        else:
            energy = compute_raw_energy(point, basins)
        if energy > max_energy:
            max_energy = energy
    return max_energy


def compute_energy(vector, landscape):
    basins = landscape["basins"]
    energy = compute_raw_energy(vector, basins)

    # Find nearest and second-nearest
    nearest_idx = 0
    nearest_dist = float("inf")
    second_dist = float("inf")
    second_idx = 0

    for i, b in enumerate(basins):
        d = euclidean_distance(vector, b["centroid"])
        if d < nearest_dist:
            second_dist = nearest_dist
            second_idx = nearest_idx
            nearest_dist = d
            nearest_idx = i
        elif d < second_dist:
            second_dist = d
            second_idx = i

    nearest = basins[nearest_idx]
    second = basins[second_idx]

    barrier = estimate_barrier(vector, second["centroid"], basins, nearest, second)
    basin_energy = compute_raw_energy(nearest["centroid"], basins)
    current_depth = energy - basin_energy
    ridge_height = barrier - basin_energy
    transition_score = min(1, current_depth / ridge_height) if ridge_height > 0 else 0

    return {
        "energy": energy,
        "nearest_basin": nearest["label"],
        "basin_depth": nearest["depth"],
        "distance_to_centre": nearest_dist,
        "barrier_to_second": barrier - energy,
        "transition_score": max(0, min(1, transition_score)),
        "current_depth": current_depth,
        "ridge_height": ridge_height,
    }


# ── Vectorised batch energy (numpy) for speed ──────────────────────────────

def batch_compute_energy(vectors_np, landscape):
    """Compute energy for all vectors at once using numpy."""
    basins = landscape["basins"]
    n = len(vectors_np)
    n_basins = len(basins)

    centroids = np.array([b["centroid"] for b in basins])
    depths_arr = np.array([b["depth"] for b in basins])
    widths_arr = np.array([b["width"] for b in basins])
    labels = [b["label"] for b in basins]

    # Distances: (n, n_basins)
    diffs = vectors_np[:, np.newaxis, :] - centroids[np.newaxis, :, :]  # (n, 9, 6)
    dist_sq = np.sum(diffs ** 2, axis=2)  # (n, 9)
    distances = np.sqrt(dist_sq)  # (n, 9)

    # Energy: E(x) = -Σ depth_i * exp(-||x - c_i||² / 2σ²)
    gaussians = depths_arr * np.exp(-dist_sq / (2 * widths_arr ** 2))
    energies = -np.sum(gaussians, axis=1)  # (n,)

    # Nearest and second-nearest basins
    nearest_idx = np.argmin(distances, axis=1)
    nearest_dist = distances[np.arange(n), nearest_idx]

    # Second nearest
    distances_masked = distances.copy()
    distances_masked[np.arange(n), nearest_idx] = float("inf")
    second_idx = np.argmin(distances_masked, axis=1)

    # Basin depth is the depth parameter of the nearest basin
    basin_depths = depths_arr[nearest_idx]
    nearest_labels = [labels[i] for i in nearest_idx]

    # Compute transition scores (need per-record barrier estimation — do it vectorised approx)
    # For each record, compute energy at basin centre
    basin_energies = np.array([
        compute_raw_energy(basins[nearest_idx[i]]["centroid"], basins)
        for i in range(n)
    ])
    current_depths = energies - basin_energies

    # Approximate barrier: sample midpoint between vector and second basin
    # Full 20-sample barrier is too slow for 10K — use 5-point approximation
    barrier_energies = np.full(n, -np.inf)
    for s in range(6):
        t = s / 5
        interp = vectors_np * (1 - t) + centroids[second_idx] * t
        # Use effective width for from/to basins
        for i in range(n):
            from_b = basins[nearest_idx[i]]
            to_b = basins[second_idx[i]]
            e = compute_raw_energy_directed(interp[i].tolist(), basins, from_b, to_b)
            if e > barrier_energies[i]:
                barrier_energies[i] = e

    ridge_heights = barrier_energies - basin_energies
    transition_scores = np.where(
        ridge_heights > 0,
        np.clip(current_depths / ridge_heights, 0, 1),
        0,
    )

    barriers_to_second = barrier_energies - energies

    results = []
    for i in range(n):
        results.append({
            "energy": float(energies[i]),
            "nearest_basin": nearest_labels[i],
            "basin_depth": float(basin_depths[i]),
            "distance_to_centre": float(nearest_dist[i]),
            "barrier_to_second": float(barriers_to_second[i]),
            "transition_score": float(transition_scores[i]),
            "current_depth": float(current_depths[i]),
            "ridge_height": float(ridge_heights[i]),
        })
    return results


# ══════════════════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════════════════

print("=" * 70)
print("POS DENSITY vs BASIN DEPTH CORRELATION TEST")
print("=" * 70)
print()

# ── Step 1: Load and stratified sample ──────────────────────────────────────
print("Step 1: Loading and sampling data...")
t0 = time.time()

records = []
with open(DATA_PATH, "r") as f:
    for line in f:
        records.append(json.loads(line))

by_comp = defaultdict(list)
for r in records:
    by_comp[r["composition"]].append(r)

sample = []
for comp, recs in by_comp.items():
    sample.extend(random.sample(recs, min(SAMPLE_SIZE_PER_COMP, len(recs))))

random.shuffle(sample)
print(f"  Total records: {len(records)}")
print(f"  Sampled {len(sample)} records across {len(by_comp)} compositions")
for comp in sorted(by_comp.keys()):
    print(f"    {comp}: {len(by_comp[comp])} total, {min(SAMPLE_SIZE_PER_COMP, len(by_comp[comp]))} sampled")
print(f"  Time: {time.time() - t0:.1f}s")

# ── Step 2: POS tag each record ─────────────────────────────────────────────
print(f"\nStep 2: POS tagging {len(sample)} records (spaCy en_core_web_sm)...")
t0 = time.time()

nlp = spacy.load("en_core_web_sm")
texts = [r["text"][:1000] for r in sample]

for i, doc in enumerate(nlp.pipe(texts, batch_size=256, n_process=1)):
    nouns = sum(1 for t in doc if t.pos_ in ("NOUN", "PROPN"))
    verbs = sum(1 for t in doc if t.pos_ == "VERB")
    total = nouns + verbs
    sample[i]["noun_ratio"] = nouns / total if total > 0 else 0.5
    sample[i]["verb_ratio"] = verbs / total if total > 0 else 0.5
    sample[i]["noun_count"] = nouns
    sample[i]["verb_count"] = verbs
    if (i + 1) % 2000 == 0:
        elapsed = time.time() - t0
        rate = (i + 1) / elapsed
        eta = (len(sample) - i - 1) / rate
        print(f"  Tagged {i + 1}/{len(sample)} ({rate:.0f} rec/s, ETA {eta:.0f}s)")

print(f"  POS tagging complete: {time.time() - t0:.1f}s")

# ── Step 3: Build energy landscape and compute ──────────────────────────────
print(f"\nStep 3: Computing energy landscape for {len(sample)} records...")
t0 = time.time()

centroids_data = json.load(open(CENTROIDS_PATH))
motifs_data = json.load(open(MOTIFS_PATH))
widths_data = json.load(open(WIDTHS_PATH))

landscape = build_landscape(centroids_data, motifs_data, widths_data)

print("  Basin configuration:")
for b in landscape["basins"]:
    print(f"    {b['label']}: depth={b['depth']:.4f}, width={b['width']:.4f}")

# Batch compute
vectors_np = np.array([r["vector"] for r in sample])
energy_results = batch_compute_energy(vectors_np, landscape)

for i, er in enumerate(energy_results):
    sample[i].update(er)

# Also compute vector magnitude
for r in sample:
    v = np.array(r["vector"])
    r["vector_magnitude"] = float(np.linalg.norm(v))

print(f"  Energy computation complete: {time.time() - t0:.1f}s")

# ── Step 4: Correlate and analyse ───────────────────────────────────────────
print(f"\nStep 4: Correlation analysis...")

noun_ratios = np.array([r["noun_ratio"] for r in sample])
q25, q50, q75 = np.percentile(noun_ratios, [25, 50, 75])

noun_heavy = [r for r in sample if r["noun_ratio"] > q75]
verb_heavy = [r for r in sample if r["noun_ratio"] < q25]

print(f"  Q25={q25:.3f}, Q50={q50:.3f}, Q75={q75:.3f}")
print(f"  Noun-heavy (ratio > {q75:.3f}): {len(noun_heavy)} records")
print(f"  Verb-heavy (ratio < {q25:.3f}): {len(verb_heavy)} records")

# ── Step 5: Statistical tests ──────────────────────────────────────────────
print(f"\nStep 5: Running statistical tests...")

results = {}

# 5a. Basin depth (the centroid-defined depth of the nearest basin)
noun_depths = np.array([r["basin_depth"] for r in noun_heavy])
verb_depths = np.array([r["basin_depth"] for r in verb_heavy])
stat, pval_greater = stats.mannwhitneyu(noun_depths, verb_depths, alternative="greater")
stat, pval_2s = stats.mannwhitneyu(noun_depths, verb_depths, alternative="two-sided")
results["basin_depth"] = {
    "noun_mean": float(np.mean(noun_depths)),
    "noun_std": float(np.std(noun_depths)),
    "verb_mean": float(np.mean(verb_depths)),
    "verb_std": float(np.std(verb_depths)),
    "diff": float(np.mean(noun_depths) - np.mean(verb_depths)),
    "mannwhitney_p_greater": float(pval_greater),
    "mannwhitney_p_twosided": float(pval_2s),
}

# Pearson: noun_ratio vs basin_depth
all_depths = np.array([r["basin_depth"] for r in sample])
corr, pval = stats.pearsonr(noun_ratios, all_depths)
results["pearson_noun_basin_depth"] = {"r": float(corr), "p": float(pval)}

# 5b. Energy (raw Langevin energy — more negative = deeper in a well)
noun_energies = np.array([r["energy"] for r in noun_heavy])
verb_energies = np.array([r["energy"] for r in verb_heavy])
stat, pval = stats.mannwhitneyu(noun_energies, verb_energies, alternative="less")
results["energy"] = {
    "noun_mean": float(np.mean(noun_energies)),
    "verb_mean": float(np.mean(verb_energies)),
    "diff": float(np.mean(noun_energies) - np.mean(verb_energies)),
    "mannwhitney_p_less": float(pval),  # noun lower energy = deeper
}

# Pearson: noun_ratio vs energy
all_energies = np.array([r["energy"] for r in sample])
corr, pval = stats.pearsonr(noun_ratios, all_energies)
results["pearson_noun_energy"] = {"r": float(corr), "p": float(pval)}

# 5c. Transition score (0=deep in basin, 1=on ridge)
noun_trans = np.array([r["transition_score"] for r in noun_heavy])
verb_trans = np.array([r["transition_score"] for r in verb_heavy])
stat, pval = stats.mannwhitneyu(noun_trans, verb_trans, alternative="less")
results["transition_score"] = {
    "noun_mean": float(np.mean(noun_trans)),
    "verb_mean": float(np.mean(verb_trans)),
    "diff": float(np.mean(noun_trans) - np.mean(verb_trans)),
    "mannwhitney_p_less": float(pval),  # noun lower = deeper in basin
}

# 5d. Distance to nearest centroid
noun_dist = np.array([r["distance_to_centre"] for r in noun_heavy])
verb_dist = np.array([r["distance_to_centre"] for r in verb_heavy])
stat, pval = stats.mannwhitneyu(noun_dist, verb_dist, alternative="two-sided")
results["distance_to_centre"] = {
    "noun_mean": float(np.mean(noun_dist)),
    "verb_mean": float(np.mean(verb_dist)),
    "diff": float(np.mean(noun_dist) - np.mean(verb_dist)),
    "mannwhitney_p": float(pval),
}

# 5e. Confidence (from lexical vectoriser)
noun_conf = np.array([r["confidence"] for r in noun_heavy])
verb_conf = np.array([r["confidence"] for r in verb_heavy])
stat, pval = stats.mannwhitneyu(noun_conf, verb_conf, alternative="two-sided")
results["confidence"] = {
    "noun_mean": float(np.mean(noun_conf)),
    "verb_mean": float(np.mean(verb_conf)),
    "diff": float(np.mean(noun_conf) - np.mean(verb_conf)),
    "mannwhitney_p": float(pval),
}
corr, pval = stats.pearsonr(noun_ratios, np.array([r["confidence"] for r in sample]))
results["pearson_noun_conf"] = {"r": float(corr), "p": float(pval)}

# 5f. Vector magnitude
noun_mag = np.array([r["vector_magnitude"] for r in noun_heavy])
verb_mag = np.array([r["vector_magnitude"] for r in verb_heavy])
stat, pval = stats.mannwhitneyu(noun_mag, verb_mag, alternative="two-sided")
results["vector_magnitude"] = {
    "noun_mean": float(np.mean(noun_mag)),
    "verb_mean": float(np.mean(verb_mag)),
    "diff": float(np.mean(noun_mag) - np.mean(verb_mag)),
    "mannwhitney_p": float(pval),
}

# 5g. Per-composition noun ratios and energy profiles
comp_stats = {}
for comp in sorted(ALL_COMPOSITIONS):
    cs = [r for r in sample if r["composition"] == comp]
    if cs:
        nr = np.array([r["noun_ratio"] for r in cs])
        cf = np.array([r["confidence"] for r in cs])
        en = np.array([r["energy"] for r in cs])
        ts = np.array([r["transition_score"] for r in cs])
        bd = np.array([r["basin_depth"] for r in cs])
        dc = np.array([r["distance_to_centre"] for r in cs])
        comp_stats[comp] = {
            "n": len(cs),
            "noun_ratio_mean": float(np.mean(nr)),
            "noun_ratio_std": float(np.std(nr)),
            "confidence_mean": float(np.mean(cf)),
            "energy_mean": float(np.mean(en)),
            "transition_mean": float(np.mean(ts)),
            "basin_depth": float(np.mean(bd)),
            "dist_to_centre_mean": float(np.mean(dc)),
        }
        # Pearson within composition
        if len(cs) > 10:
            corr, pval = stats.pearsonr(nr, en)
            comp_stats[comp]["pearson_nr_energy"] = {"r": float(corr), "p": float(pval)}

# 5h. Spearman rank correlation (more robust to non-linearity)
rho, pval = stats.spearmanr(noun_ratios, all_depths)
results["spearman_noun_basin_depth"] = {"rho": float(rho), "p": float(pval)}
rho, pval = stats.spearmanr(noun_ratios, all_energies)
results["spearman_noun_energy"] = {"rho": float(rho), "p": float(pval)}

# ── Step 6: Report ──────────────────────────────────────────────────────────
print()
print()
print("=" * 70)
print("NOUN vs VERB BASIN DEPTH CORRELATION TEST — RESULTS")
print("=" * 70)
print()
print(f"Sample: {len(sample)} records (stratified {SAMPLE_SIZE_PER_COMP}/composition)")
print(f"Source: {len(records)} total records from training_data_dir_v1.jsonl")
print(f"Overall noun ratio: mean={np.mean(noun_ratios):.3f}, std={np.std(noun_ratios):.3f}")
print(f"Quartiles: Q25={q25:.3f}, Q50={q50:.3f}, Q75={q75:.3f}")
print(f"Noun-heavy (top 25%, ratio > {q75:.3f}): {len(noun_heavy)} records")
print(f"Verb-heavy (bottom 25%, ratio < {q25:.3f}): {len(verb_heavy)} records")
print()

# Basin depth
bd = results["basin_depth"]
print("─── BASIN DEPTH (nearest basin's configured depth) ───")
print(f"  Noun-heavy mean: {bd['noun_mean']:.4f} ± {bd['noun_std']:.4f}")
print(f"  Verb-heavy mean: {bd['verb_mean']:.4f} ± {bd['verb_std']:.4f}")
print(f"  Difference:      {bd['diff']:+.4f}")
print(f"  Mann-Whitney U (noun > verb): p={bd['mannwhitney_p_greater']:.4e}")
pnb = results["pearson_noun_basin_depth"]
print(f"  Pearson (noun_ratio vs basin_depth): r={pnb['r']:.4f}, p={pnb['p']:.4e}")
snb = results["spearman_noun_basin_depth"]
print(f"  Spearman (noun_ratio vs basin_depth): ρ={snb['rho']:.4f}, p={snb['p']:.4e}")
print()

# Energy
en = results["energy"]
print("─── RAW LANGEVIN ENERGY (more negative = deeper in well) ───")
print(f"  Noun-heavy mean: {en['noun_mean']:.4f}")
print(f"  Verb-heavy mean: {en['verb_mean']:.4f}")
print(f"  Difference:      {en['diff']:+.4f}")
print(f"  Mann-Whitney U (noun < verb, i.e. deeper): p={en['mannwhitney_p_less']:.4e}")
pne = results["pearson_noun_energy"]
print(f"  Pearson (noun_ratio vs energy): r={pne['r']:.4f}, p={pne['p']:.4e}")
sne = results["spearman_noun_energy"]
print(f"  Spearman (noun_ratio vs energy): ρ={sne['rho']:.4f}, p={sne['p']:.4e}")
print()

# Transition score
ts = results["transition_score"]
print("─── TRANSITION SCORE (0=deep in basin, 1=on ridge) ───")
print(f"  Noun-heavy mean: {ts['noun_mean']:.4f}")
print(f"  Verb-heavy mean: {ts['verb_mean']:.4f}")
print(f"  Difference:      {ts['diff']:+.4f}")
print(f"  Mann-Whitney U (noun < verb, i.e. deeper): p={ts['mannwhitney_p_less']:.4e}")
print()

# Distance to centre
dc = results["distance_to_centre"]
print("─── DISTANCE TO NEAREST CENTROID ───")
print(f"  Noun-heavy mean: {dc['noun_mean']:.4f}")
print(f"  Verb-heavy mean: {dc['verb_mean']:.4f}")
print(f"  Difference:      {dc['diff']:+.4f}")
print(f"  Mann-Whitney U (two-sided): p={dc['mannwhitney_p']:.4e}")
print()

# Confidence
cf = results["confidence"]
print("─── LEXICAL VECTORISER CONFIDENCE ───")
print(f"  Noun-heavy mean: {cf['noun_mean']:.4f}")
print(f"  Verb-heavy mean: {cf['verb_mean']:.4f}")
print(f"  Difference:      {cf['diff']:+.4f}")
print(f"  Mann-Whitney U (two-sided): p={cf['mannwhitney_p']:.4e}")
pcf = results["pearson_noun_conf"]
print(f"  Pearson (noun_ratio vs confidence): r={pcf['r']:.4f}, p={pcf['p']:.4e}")
print()

# Vector magnitude
vm = results["vector_magnitude"]
print("─── VECTOR MAGNITUDE (||v||₂) ───")
print(f"  Noun-heavy mean: {vm['noun_mean']:.4f}")
print(f"  Verb-heavy mean: {vm['verb_mean']:.4f}")
print(f"  Difference:      {vm['diff']:+.4f}")
print(f"  Mann-Whitney U (two-sided): p={vm['mannwhitney_p']:.4e}")
print()

# Per-composition
print("─── PER-COMPOSITION BREAKDOWN ───")
header = f"  {'Comp':<6} {'N':>5} {'NounR':>7} {'±Std':>6} {'Conf':>6} {'Energy':>8} {'Trans':>6} {'Depth':>7} {'DistC':>7}"
print(header)
print(f"  {'-' * (len(header) - 2)}")
for comp in sorted(comp_stats.keys()):
    cs = comp_stats[comp]
    print(
        f"  {comp:<6} {cs['n']:>5} {cs['noun_ratio_mean']:>7.3f} {cs['noun_ratio_std']:>6.3f} "
        f"{cs['confidence_mean']:>6.3f} {cs['energy_mean']:>8.4f} {cs['transition_mean']:>6.3f} "
        f"{cs['basin_depth']:>7.3f} {cs['dist_to_centre_mean']:>7.3f}"
    )
print()

# Within-composition correlations
print("─── WITHIN-COMPOSITION: noun_ratio vs energy (Pearson) ───")
for comp in sorted(comp_stats.keys()):
    cs = comp_stats[comp]
    if "pearson_nr_energy" in cs:
        p = cs["pearson_nr_energy"]
        sig = "***" if p["p"] < 0.001 else "**" if p["p"] < 0.01 else "*" if p["p"] < 0.05 else ""
        print(f"  {comp}: r={p['r']:+.4f}, p={p['p']:.4e} {sig}")
print()

# ── VERDICT ─────────────────────────────────────────────────────────────────
print("=" * 70)

sig_tests = []
# Basin depth: noun > verb?
sig_tests.append(("Basin depth (noun > verb)", bd["mannwhitney_p_greater"] < 0.05, bd["mannwhitney_p_greater"]))
# Energy: noun lower (deeper)?
sig_tests.append(("Energy (noun deeper)", en["mannwhitney_p_less"] < 0.05, en["mannwhitney_p_less"]))
# Transition: noun lower (more settled)?
sig_tests.append(("Transition score (noun lower)", ts["mannwhitney_p_less"] < 0.05, ts["mannwhitney_p_less"]))
# Confidence
sig_tests.append(("Confidence differs", cf["mannwhitney_p"] < 0.05, cf["mannwhitney_p"]))
# Distance to centre
sig_tests.append(("Distance to centre differs", dc["mannwhitney_p"] < 0.05, dc["mannwhitney_p"]))

sig_count = sum(1 for _, sig, _ in sig_tests if sig)
total_tests = len(sig_tests)

print(f"\nSignificance summary ({sig_count}/{total_tests} tests at p < 0.05):")
for name, sig, pval in sig_tests:
    marker = "✓ SIG" if sig else "✗ n.s."
    print(f"  [{marker}] {name}: p={pval:.4e}")

print()
if sig_count >= 3:
    verdict = "SUPPORTS"
    detail = f"{sig_count}/{total_tests} tests significant — strong evidence"
elif sig_count >= 2:
    verdict = "WEAKLY SUPPORTS"
    detail = f"{sig_count}/{total_tests} tests significant — suggestive"
elif sig_count == 1:
    verdict = "INCONCLUSIVE"
    detail = f"Only {sig_count}/{total_tests} test significant — insufficient evidence"
else:
    verdict = "DOES NOT SUPPORT"
    detail = f"0/{total_tests} tests significant on Gen 1 lexical data"

print(f"VERDICT: {verdict}")
print(f"  {detail}")
print()

if verdict in ("DOES NOT SUPPORT", "INCONCLUSIVE"):
    print("NOTE: A negative result on Gen 1 lexical data does NOT falsify the")
    print("hypothesis. The lexical vectoriser has known limitations (488 indicators,")
    print("vocabulary-dependent, low confidence). The proper test requires Gen 2's")
    print("semantic classifications.")
elif verdict in ("SUPPORTS", "WEAKLY SUPPORTS"):
    print("NOTE: A positive result on Gen 1 lexical data is notable — if even the")
    print("crude lexical vectoriser captures this signal, the effect is likely robust.")
    print("Consider incorporating energy-regime awareness into Gen 2.")

print("=" * 70)

# ── Save raw results ────────────────────────────────────────────────────────
output = {
    "test": "POS Density vs Basin Depth Correlation",
    "date": time.strftime("%Y-%m-%d %H:%M:%S"),
    "config": {
        "sample_size": len(sample),
        "total_records": len(records),
        "compositions": len(by_comp),
        "seed": SEED,
        "spacy_model": "en_core_web_sm",
        "energy_method": "embedded Langevin multi-well (ported from energy-core.ts)",
    },
    "quartiles": {"q25": float(q25), "q50": float(q50), "q75": float(q75)},
    "group_sizes": {
        "noun_heavy": len(noun_heavy),
        "verb_heavy": len(verb_heavy),
    },
    "results": results,
    "comp_stats": comp_stats,
    "verdict": verdict,
    "verdict_detail": detail,
}

with open("01-Projects/dir-engine/output/pos_basin_correlation_raw.json", "w") as f:
    json.dump(output, f, indent=2)

print(f"\nRaw results: 01-Projects/dir-engine/output/pos_basin_correlation_raw.json")
