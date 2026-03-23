---
title: "Extended B Run 6: Prediction-Error as Primary Signal — T0 Expansion"
date: 2026-03-23
status: draft
target_motif: prediction-error-as-primary-signal
target_gap: "T0→T1 domain expansion"
---

# Extended B Run 6: Prediction-Error as Primary Signal — T0 Expansion

## Context

The motif "Prediction-Error as Primary Signal" currently sits at Tier 0 with two instances across two domains (Cognitive Science/Neuroscience and Music Theory). The frontmatter lists `domain_count: 1`, which is a bookkeeping error — it already has two unrelated domain instances and qualifies for T1 auto-promotion. This run strengthens the case by finding additional domain instances beyond the two already documented.

## Structural Target

> A system that generates expectations transmits only the delta between prediction and reality, making surprise — not confirmation — the primary information carrier.

Key structural requirements for a valid instance:
1. The system must generate a genuine forward model (prediction precedes observation)
2. The comparison between prediction and observation must produce a difference signal
3. That difference signal — not the raw observation — must be what propagates and drives system behaviour

---

## Candidate Instance 3: Control Theory — Innovation Signal in Kalman Filters

### Description

The Kalman filter (Rudolf Kalman, 1960) is the canonical example of prediction-error-as-primary-signal in engineering. The filter maintains an internal state estimate and a covariance matrix representing uncertainty. At each time step it performs two phases:

1. **Predict:** The filter uses a state-transition model to project its current estimate forward in time, producing a predicted observation.
2. **Update:** The actual measurement arrives. The filter computes the *innovation* — the difference between the predicted measurement and the actual measurement. The Kalman gain determines how much this innovation corrects the state estimate.

The update equation is:

```
x̂(k|k) = x̂(k|k-1) + K(k) · [z(k) - H·x̂(k|k-1)]
```

The term `[z(k) - H·x̂(k|k-1)]` is the innovation (prediction error). When the innovation is zero, the state estimate does not change — the system coasts on its model. When the innovation is large, the state estimate shifts. The raw measurement `z(k)` never directly overwrites the state; only the delta between prediction and measurement drives the update.

This is not merely analogous to prediction-error-as-primary-signal — it is the mathematical formalisation of the pattern. The innovation sequence in a well-tuned Kalman filter should be white noise (uncorrelated, zero-mean), which means all extractable information has been absorbed into the model. If the innovation sequence shows structure (autocorrelation), it indicates the model is failing to predict, and the filter needs retuning.

### Structural Fit: Strong

- **Genuine forward model:** The state-transition matrix generates a prediction before the measurement arrives. Temporal priority is explicit.
- **Delta as primary signal:** The innovation term is literally the prediction error. The Kalman gain modulates how much the error updates the state.
- **Raw state suppressed:** The raw measurement never directly replaces the state estimate. It participates only through the innovation.
- **Efficiency consequence:** The innovation representation is maximally compressed — a well-tuned filter reduces the innovation to white noise, meaning no redundant structure remains. This matches the motif's claim that prediction-error architectures are informationally efficient.

### Specific frameworks and references

- Kalman, R. E. (1960). "A New Approach to Linear Filtering and Prediction Problems." *Journal of Basic Engineering*, 82(1), 35-45.
- The innovation sequence is central to the Mehra-Phadke filter diagnostic: if innovations are not white, the model is misspecified.
- Extended Kalman Filters (EKF), Unscented Kalman Filters (UKF), and particle filters all preserve this architecture — they differ in how they compute the prediction, but all drive updates via prediction error.

### Domain: Control Theory / Estimation Theory

---

## Candidate Instance 4: Financial Economics — Efficient Market Hypothesis and Price Innovation

### Description

The Efficient Market Hypothesis (EMH), formalised by Eugene Fama (1970), asserts that asset prices fully reflect all available information. The structural consequence is that price changes are driven only by *new* information — information that was not already predicted by the market's aggregate model.

In the semi-strong form of EMH:
- The current price represents the market's forward model (the aggregate prediction of future value given all public information).
- When new information arrives (an earnings surprise, a policy announcement, an unexpected event), the price adjusts by exactly the delta between what the market predicted and what was revealed.
- If the information was already anticipated (priced in), the event causes no price movement — the prediction error is zero.

This produces a specific testable prediction: in an efficient market, price changes should follow a random walk (or more precisely, a martingale). The *returns* series should be unpredictable. This is structurally identical to the Kalman filter's white-noise innovation sequence — a well-functioning prediction-error system leaves no extractable structure in the error signal.

The phenomenon of "buy the rumour, sell the news" illustrates this directly. When an expected positive event actually occurs, the price often falls — because the prediction was already incorporated, and any remaining delta is typically negative (the reality was slightly less than the inflated expectation). The market literally signals on prediction error, not on the raw event.

### Structural Fit: Strong

- **Genuine forward model:** The current market price is the consensus prediction. It temporally precedes the new information.
- **Delta as primary signal:** Only the unexpected component of news moves prices. Expected earnings produce no price movement; earnings *surprises* produce movement proportional to the surprise magnitude.
- **Raw state suppressed:** The absolute level of earnings, revenue, or economic indicators does not directly determine price changes. Only the deviation from consensus forecast matters.
- **Efficiency consequence:** If the error signal shows structure (autocorrelation in returns), it implies market inefficiency — equivalent to a poorly tuned Kalman filter. The structural prediction is identical.

### Specific frameworks and references

- Fama, E. (1970). "Efficient Capital Markets: A Review of Theory and Empirical Work." *Journal of Finance*, 25(2), 383-417.
- The earnings surprise literature: Ball and Brown (1968) demonstrated that stock prices respond to the unexpected component of earnings announcements, not the absolute level.
- Post-earnings announcement drift (PEAD) is the best-documented anomaly — it represents a case where the prediction-error signal is *not* fully absorbed in one step, analogous to a sluggish Kalman gain.
- Event study methodology (Fama, Fisher, Jensen, Roll 1969) is built entirely on measuring abnormal returns — the prediction error between expected and actual returns around an event.

### Domain: Financial Economics

---

## Candidate Instance 5: Communication Engineering — Differential Pulse-Code Modulation (DPCM) and Predictive Video Coding

### Description

In digital signal processing and video compression, Differential Pulse-Code Modulation (DPCM) and its descendants (MPEG inter-frame coding, H.264/AVC, H.265/HEVC) implement prediction-error-as-primary-signal as an explicit engineering design.

The architecture:
1. **Predict:** A predictor generates an estimate of the next sample (in audio) or the next frame (in video) based on previous samples/frames. In video, this uses motion compensation — the encoder predicts each block of the current frame by finding the best-matching block in the reference frame and applying a motion vector.
2. **Compute residual:** The encoder computes the difference between the predicted frame and the actual frame. This difference is the *residual* (prediction error).
3. **Transmit residual:** Only the residual is quantised, entropy-coded, and transmitted. The decoder, which has the same predictor, reconstructs the frame by applying the residual to its own prediction.

The compression gain is enormous precisely because the prediction error has far less information content than the raw signal. A typical video frame might require 3 megabytes raw; after motion-compensated prediction, the residual might require 30 kilobytes. The prediction-error representation achieves 100:1 compression because most of the signal was predictable.

When a scene cut occurs (prediction completely fails), the residual is as large as the raw frame, and the system falls back to intra-coding (transmitting raw state). This is the system explicitly detecting that prediction-error-as-primary-signal fails when there is no valid forward model, and gracefully degrading.

### Structural Fit: Strong

- **Genuine forward model:** The motion-compensated predictor generates an explicit predicted frame before the actual frame is compared. Temporal priority is built into the codec pipeline.
- **Delta as primary signal:** The residual — literally the pixel-by-pixel prediction error — is the only signal transmitted between encoder and decoder. The predicted frame is never transmitted; only the correction to it.
- **Raw state suppressed:** Intra-frames (raw state) are transmitted only when prediction fails entirely (scene cuts) or periodically for random-access points. The vast majority of transmitted data is prediction error.
- **Efficiency consequence:** The compression ratio directly measures how much information the prediction-error representation saves over raw state. This is the motif's efficiency claim made quantitatively measurable.

### Specific frameworks and references

- DPCM: Cutler (1952, Bell Labs patent) for the basic delta-coding concept; Oliver, Pierce, and Shannon (1948) for the information-theoretic grounding.
- MPEG-2, H.264/AVC (ITU-T Rec. H.264), H.265/HEVC: all implement motion-compensated prediction with residual coding as their core inter-frame compression strategy.
- The rate-distortion theory (Shannon, 1959) provides the theoretical bound: prediction-error coding approaches the rate-distortion limit faster than raw coding because it removes predictable redundancy before quantisation.
- Lossless predictive coding (PNG uses a spatial predictor + delta; FLAC uses linear prediction + residual) demonstrates the pattern outside lossy video.

### Domain: Communication Engineering / Signal Processing

---

## Structural Comparison Across All Five Domains

| Property | Neuroscience | Music Theory | Control Theory | Financial Economics | Communication Engineering |
|----------|-------------|-------------|----------------|-------------------|--------------------------|
| Forward model | Cortical hierarchy top-down predictions | Harmonic expectation built by progression | State-transition matrix | Market consensus price | Motion-compensated predictor |
| Error signal | Prediction error flowing upward | Deceptive cadence surprise | Kalman innovation | Earnings surprise / abnormal return | Residual frame |
| What propagates | Error only | Emotional impact of violation | Innovation only | Price change only | Residual only |
| White-noise test | Well-adapted brain shows minimal ongoing error | Resolved passages produce low tension | Well-tuned filter: white innovation | Efficient market: random-walk returns | High-quality predictor: sparse residual |
| Failure mode | Psychosis (prior overwhelms error), anxiety (error overwhelms prior) | Tonal collapse (no expectation framework) | Filter divergence | Bubbles and crashes | Scene cut fallback to intra-coding |

## Assessment

All three new instances satisfy the structural requirements:

1. **Genuine forward model with temporal priority** — In each case, the prediction is generated before the observation arrives.
2. **Delta as the primary propagated signal** — In each case, the difference between prediction and reality is what drives downstream processing, not the raw observation.
3. **Efficiency advantage** — In each case, the prediction-error architecture is demonstrably more efficient than raw-state transmission (information-theoretically in communication engineering, computationally in control theory, informationally in financial economics).

The three new domains (Control Theory, Financial Economics, Communication Engineering) are unrelated to the two existing domains (Cognitive Science, Music Theory) and to each other. The motif now spans five domains across hard sciences, social sciences, engineering, and the arts.

## Recommendation

1. **Fix bookkeeping:** Update `domain_count: 1` to `domain_count: 2` in the motif's current frontmatter (correcting the existing error).
2. **Add three instances:** Append Instances 3, 4, and 5 to the motif entry.
3. **Promote to Tier 1:** Update `tier: 1`, `status: provisional`, `confidence: 0.4` (base 0.1 + 0.3 for three new domain instances), `domain_count: 5`.
4. **Consider Tier 2 candidacy:** With five domains and strong structural fit across all of them, this motif is a natural candidate for the Tier 2 validation protocol. The Kalman filter instance in particular provides a mathematical formalisation that strengthens adversarial survival. Recommend queuing for Tier 2 evaluation pending Adam's approval.
