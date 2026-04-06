"""
2-state Hidden Markov Model for vol regime classification (v6).

Two states:
  Kinetic — high vol, expanding (maps to D+R combined)
  Quiet   — low vol, mean-reverting (maps to I)

Labelling: highest mean realized_vol = Kinetic, lowest = Quiet.
Direction is handled downstream by momentum, not by the HMM.
"""

import numpy as np
from hmmlearn.hmm import GaussianHMM


class HMMRegimeClassifier:

    def __init__(self, n_states: int = 2, n_iter: int = 100):
        self.n_states = n_states
        self.n_iter = n_iter
        self.model: GaussianHMM | None = None
        self._state_map: dict[int, str] = {}

    def fit(self, features: np.ndarray):
        self.model = GaussianHMM(
            n_components=self.n_states,
            covariance_type="full",
            n_iter=self.n_iter,
            random_state=42,
        )
        self.model.fit(features)
        self._assign_labels()

    def _assign_labels(self):
        """Highest mean vol = Kinetic, lowest = Quiet."""
        means = self.model.means_
        vol_col = 1  # [log_return, realized_vol]
        vol_means = means[:, vol_col]

        kinetic = int(np.argmax(vol_means))
        quiet = int(np.argmin(vol_means))

        self._state_map = {kinetic: "Kinetic", quiet: "Quiet"}

        for s in [quiet, kinetic]:
            label = self._state_map[s]
            print(f"      State {s} -> {label}: "
                  f"log_ret={means[s,0]:+.4f}  vol={means[s,1]:.4f}")

    def predict(self, features: np.ndarray) -> list[str]:
        raw = self.model.predict(features)
        return [self._state_map.get(int(s), "Quiet") for s in raw]

    def state_means(self) -> dict[str, dict[str, float]]:
        cols = ["log_return", "realized_vol"]
        inv = {v: k for k, v in self._state_map.items()}
        return {
            label: {c: float(self.model.means_[inv[label], i]) for i, c in enumerate(cols)}
            for label in ["Kinetic", "Quiet"]
        }

    def get_transition_matrix(self) -> dict[str, dict[str, float]]:
        raw = self.model.transmat_
        inv = {v: k for k, v in self._state_map.items()}
        result = {}
        for fl in ["Kinetic", "Quiet"]:
            result[fl] = {}
            for tl in ["Kinetic", "Quiet"]:
                result[fl][tl] = float(raw[inv[fl], inv[tl]])
        return result
