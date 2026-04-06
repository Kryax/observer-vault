"""
3-state Hidden Markov Model for D/I/R regime classification.

v4: 2-feature (log_return + realized_vol) with forward-return labelling.

States labelled by empirical forward returns on training data:
  D — state with highest mean 24h forward return (deploy capital)
  I — middle state
  R — state with lowest mean 24h forward return (exit to cash)
"""

import numpy as np
from hmmlearn.hmm import GaussianHMM


class HMMRegimeClassifier:

    def __init__(self, n_states: int = 3, n_iter: int = 100):
        self.n_states = n_states
        self.n_iter = n_iter
        self.model: GaussianHMM | None = None
        self._state_map: dict[int, str] = {}

    def fit(self, features: np.ndarray, prices: np.ndarray | None = None, forward_window: int = 24):
        """
        Fit HMM on features.
        If prices provided, labels states by forward returns (v4).
        Otherwise falls back to feature-based labelling (v1-v3).
        """
        self.model = GaussianHMM(
            n_components=self.n_states,
            covariance_type="full",
            n_iter=self.n_iter,
            random_state=42,
        )
        self.model.fit(features)

        if prices is not None:
            self._assign_labels_by_forward_returns(features, prices, forward_window)
        else:
            self._assign_labels_by_features()

    def _assign_labels_by_forward_returns(self, features: np.ndarray, prices: np.ndarray, forward_window: int = 24):
        """
        Label states by empirical forward returns.
        Guarantees D has best returns, R has worst.
        """
        states = self.model.predict(features)

        # Forward returns for each bar
        fwd_returns = np.full(len(prices), np.nan)
        for i in range(len(prices) - forward_window):
            fwd_returns[i] = np.log(prices[i + forward_window] / prices[i])

        # Mean forward return per state
        state_fwd = {}
        for s in range(self.n_states):
            mask = (states == s) & ~np.isnan(fwd_returns)
            if mask.sum() > 0:
                state_fwd[s] = float(np.mean(fwd_returns[mask]))
            else:
                state_fwd[s] = 0.0

        sorted_states = sorted(state_fwd.keys(), key=lambda s: state_fwd[s])

        self._state_map = {
            sorted_states[0]: "R",   # worst forward returns
            sorted_states[1]: "I",   # middle
            sorted_states[2]: "D",   # best forward returns
        }

        for s in sorted_states:
            label = self._state_map[s]
            print(f"      State {s} -> {label}: mean fwd return = {state_fwd[s]*100:+.4f}%")

    def _assign_labels_by_features(self):
        """Fallback: label by feature means (v1-v3 method)."""
        means = self.model.means_
        # Assume features are [log_return, realized_vol] for 2-feature model
        n_feat = means.shape[1]
        vol_col = min(1, n_feat - 1)  # vol is col 1 in 2-feature, col 2 in 4-feature

        vol_means = means[:, vol_col]
        r_state = int(np.argmax(vol_means))
        remaining = [i for i in range(self.n_states) if i != r_state]
        # Lower vol of remaining = I, higher = D
        d_state = remaining[int(np.argmax(vol_means[remaining]))]
        i_state = [i for i in remaining if i != d_state][0]

        self._state_map = {d_state: "D", i_state: "I", r_state: "R"}

    def predict(self, features: np.ndarray) -> list[str]:
        raw = self.model.predict(features)
        return [self._state_map.get(int(s), "I") for s in raw]

    def predict_proba(self, features: np.ndarray) -> np.ndarray:
        raw = self.model.predict_proba(features)
        ordered = np.zeros_like(raw)
        for raw_idx, label in self._state_map.items():
            col = {"D": 0, "I": 1, "R": 2}[label]
            ordered[:, col] = raw[:, raw_idx]
        return ordered

    def get_transition_matrix(self) -> dict[str, dict[str, float]]:
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
        n_feat = self.model.means_.shape[1]
        if n_feat == 2:
            cols = ["log_return", "realized_vol"]
        else:
            cols = ["hurst", "log_return", "realized_vol", "autocorrelation"]
        inv = {v: k for k, v in self._state_map.items()}
        return {
            label: {c: float(self.model.means_[inv[label], i]) for i, c in enumerate(cols)}
            for label in ["D", "I", "R"]
        }
