"""
3-state Hidden Markov Model for D/I/R regime classification.

States:
  D (Trending)      — high Hurst, positive autocorrelation, moderate vol
  I (Consolidating) — Hurst ~0.5, low vol, low autocorrelation
  R (Reflexive)     — high vol, strong autocorrelation, negative returns
"""

import numpy as np
from hmmlearn.hmm import GaussianHMM


class HMMRegimeClassifier:

    def __init__(self, n_states: int = 3, n_iter: int = 100):
        self.n_states = n_states
        self.n_iter = n_iter
        self.model: GaussianHMM | None = None
        self._state_map: dict[int, str] = {}

    def fit(self, features: np.ndarray):
        """Fit HMM on features of shape (n_bars, 4)."""
        self.model = GaussianHMM(
            n_components=self.n_states,
            covariance_type="full",
            n_iter=self.n_iter,
            random_state=42,
        )
        self.model.fit(features)
        self._assign_labels()

    def _assign_labels(self):
        """Map HMM state indices to D/I/R based on learned means."""
        means = self.model.means_  # (3, 4): [hurst, log_return, vol, autocorr]

        hurst_means = means[:, 0]
        vol_means = means[:, 2]

        d_state = int(np.argmax(hurst_means))
        r_state = int(np.argmax(vol_means))

        if d_state == r_state:
            autocorr_means = np.abs(means[:, 3])
            r_state = int(np.argmax(autocorr_means))
            if r_state == d_state:
                remaining = [i for i in range(3) if i != d_state]
                r_state = remaining[int(np.argmax(vol_means[remaining]))]

        i_state = [i for i in range(3) if i != d_state and i != r_state][0]

        self._state_map = {d_state: "D", i_state: "I", r_state: "R"}

    def predict(self, features: np.ndarray) -> list[str]:
        """Predict D/I/R label for each bar."""
        raw = self.model.predict(features)
        return [self._state_map.get(int(s), "I") for s in raw]

    def predict_proba(self, features: np.ndarray) -> np.ndarray:
        """State probabilities for each bar, columns ordered D/I/R."""
        raw = self.model.predict_proba(features)
        ordered = np.zeros_like(raw)
        for raw_idx, label in self._state_map.items():
            col = {"D": 0, "I": 1, "R": 2}[label]
            ordered[:, col] = raw[:, raw_idx]
        return ordered

    def get_transition_matrix(self) -> dict[str, dict[str, float]]:
        """Transition matrix with D/I/R labels."""
        raw = self.model.transmat_
        labels = ["D", "I", "R"]
        inv = {v: k for k, v in self._state_map.items()}
        result = {}
        for fl in labels:
            result[fl] = {}
            for tl in labels:
                result[fl][tl] = float(raw[inv[fl], inv[tl]])
        return result

    def state_means(self) -> dict[str, dict[str, float]]:
        """Return learned state means keyed by D/I/R."""
        cols = ["hurst", "log_return", "realized_vol", "autocorrelation"]
        inv = {v: k for k, v in self._state_map.items()}
        return {
            label: {c: float(self.model.means_[inv[label], i]) for i, c in enumerate(cols)}
            for label in ["D", "I", "R"]
        }
