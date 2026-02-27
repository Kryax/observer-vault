# Task P — Raw Teammate Perspectives
# Problem: Verification of non-deterministic outcomes at exit boundaries (AMB-07)

## Teammate 1: Epistemology of Evidence

### 1. Types of Evidence for Deterministic vs Non-Deterministic Claims

Deterministic claims produce what I'd call **correspondence evidence** -- the claim maps directly onto an observable state. "Tests pass" corresponds to a test runner returning exit code 0. "File exists" corresponds to a filesystem check. The evidence is the state itself. There is no interpretive gap between the claim and its verification. The observer and the phenomenon share a common language: boolean.

Non-deterministic claims produce **inferential evidence** -- artifacts from which quality must be *inferred* rather than directly observed. "Research is thorough" cannot be read off any single artifact. Instead, evidence takes the form of: number of sources consulted, diversity of perspectives represented, whether counterarguments were addressed, whether the research question was actually answered. Each of these is individually checkable, but thoroughness itself is a judgment synthesized across them.

The critical insight: **these are not two categories but a spectrum governed by the size of the interpretive gap.** "Tests pass" has a near-zero interpretive gap. "Code is readable" has a small gap (naming conventions, function length, comment density are measurable proxies). "Design is coherent" has a large gap. "Perspectives were genuinely distinct" has perhaps the largest gap of any claim in a multi-agent system -- because distinctness lives in semantic space, not syntactic space.

What makes this a spectrum rather than a binary is that even "deterministic" claims carry hidden interpretation. "Tests pass" is only meaningful evidence if the tests themselves are good. The evidence bottoms out at judgment eventually. The question is how many layers of indirection separate the claim from the judgment call.

### 2. What "Verification" Can Mean for Judgment-Dependent Outcomes

For judgment-dependent outcomes, verification cannot mean confirmation. It must mean **structured justification with exposed reasoning**. Specifically:

**Trace evidence**: Show the process that produced the outcome. If research is claimed thorough, exhibit the search queries, sources consulted, and synthesis steps. The trace doesn't prove thoroughness, but its absence would disprove any claim of rigor. This is necessary-but-not-sufficient evidence.

**Proxy decomposition**: Break the non-deterministic claim into maximally-deterministic sub-claims. "Research is thorough" decomposes into: at least N sources consulted (deterministic), multiple viewpoints represented (semi-deterministic -- countable), key counterarguments addressed (judgment-dependent but narrower). Each decomposition step shrinks the interpretive gap even if it cannot eliminate it.

**Adversarial surface**: Expose the claim to challenge. The strongest evidence for a judgment-dependent outcome is that it survived structured objection. A design claimed coherent that has been examined for internal contradictions and found consistent carries more evidential weight than one merely asserted coherent.

This means "proof" for judgment-dependent outcomes is fundamentally **dialectical** rather than demonstrative. You cannot point to a state; you can present an argument that withstands scrutiny.

### 3. Proposed Handling at Exit Boundaries

Exit boundaries should operate a **two-track verification protocol**:

**Track A (deterministic claims)**: Binary pass/fail. Standard ISC-style criteria. "Tests pass," "file exists," "endpoint returns 200." These gate exit: fail any, exit is blocked.

**Track B (non-deterministic claims)**: Structured disclosure. The exiting agent must provide: (a) the claim, (b) the proxy decomposition showing which sub-claims are satisfied, (c) the trace evidence, and (d) an explicit statement of the residual judgment gap -- the part that cannot be mechanically verified. The reviewing agent or principal then makes the judgment call with full visibility.

The constitution's guardrail -- "if proof is not possible, the limitation must be stated explicitly" -- becomes the operating principle for Track B. The agent does not claim "research is thorough." It claims: "research consulted 7 sources across 3 domains, addressed 2 identified counterarguments, and the judgment of thoroughness remains with the reviewer given these artifacts."

### 4. Limits of This Approach

**Proxy decomposition can become theater.** Checking 7 sources means nothing if the sources are shallow or redundant. The decomposition creates new judgment-dependent sub-claims at a finer grain, and at some point further decomposition yields diminishing returns.

**Trace evidence is costly.** Requiring full process documentation for every non-deterministic claim introduces overhead that may exceed the value of the verification itself. There is an economic boundary to how much evidence is worth producing.

**The reviewer bottleneck remains.** Track B ultimately shifts the judgment burden to the exit reviewer. If the reviewer is also an AI agent, the interpretive gap has not been closed -- it has been relocated. Genuine verification of judgment-dependent outcomes may require a human in the loop, which the system cannot always guarantee.

**Adversarial testing has scope limits.** An agent stress-testing its own output for coherence is constrained by the same model that produced the output. Blind spots in generation may be blind spots in review. This is an argument for multi-model verification but not a guarantee of adequacy.

---

## Teammate 2: Practical Workflow

### 1. How Existing Review Systems Handle Non-Deterministic Quality

Working review systems never actually verify quality in the formal sense. They do something different entirely.

**Code review** doesn't prove code is correct. Reviewers check whether the approach is reasonable, whether edge cases were considered, whether the code is readable, and whether it follows established patterns. The implicit standard is "would I be comfortable maintaining this?" -- a judgment call, not a verification. Approval means "I looked at this carefully and nothing alarmed me," not "this is proven correct."

**Academic peer review** operates on structured disagreement. Two or three reviewers independently assess whether methodology is sound, whether claims are supported by evidence presented, and whether the work advances the field. They frequently disagree. The system handles this through editorial judgment that weighs reviewer arguments, not through reconciling toward a single truth. A paper gets accepted when reviewers find the reasoning defensible, not when the conclusions are verified.

**Editorial review** of creative work uses even softer criteria: Does this piece accomplish what it sets out to do? Is the structure serving the argument? Are there internal contradictions? Good editors don't evaluate whether a piece is "correct" -- they evaluate whether it is coherent and whether the writer earned their conclusions through the actual text.

**Design critique** focuses on whether decisions can be articulated and defended. "Why did you choose this layout?" requires a reason, not proof. The review catches decisions that were unconsidered or arbitrary, not decisions that were wrong in some absolute sense.

### 2. What These Systems Do That Formal Verification Misses

The common thread across all four: **working review systems verify process and defensibility, not outcomes.** They ask:

- Were the right inputs considered?
- Can the creator articulate why they made their choices?
- Are there internal contradictions or blind spots?
- Does the reasoning hold together on its own terms?

They also rely heavily on **reviewer expertise as a legitimate instrument.** An experienced code reviewer's discomfort is treated as meaningful signal even when they can't formalize exactly what's wrong. Peer reviewers' domain knowledge counts. This is the opposite of "if it can't be verified, it shouldn't be claimed" -- it's closer to "trained judgment is itself a form of evidence."

Additionally, these systems use **calibrated language naturally.** Reviewers say "this seems weak" or "I'm not convinced by this section" rather than rendering binary pass/fail verdicts. The gradient is the point.

### 3. Proposed Handling at Exit Boundaries

At exit boundaries for non-deterministic outcomes, apply review-system logic:

**Verify the verifiable parts.** Were stated inputs actually used? Do factual claims check out? Are there internal contradictions? This is straightforward and aligns with P-DOC-01.

**For non-deterministic quality, require defensibility instead of proof.** The exit check asks: "Can the producing agent articulate the reasoning behind qualitative judgments?" If research quality is claimed, the check is whether methodology was sound and whether limitations were stated -- not whether conclusions are objectively correct.

**Use structured reviewer judgment explicitly.** The reviewing agent at the exit boundary applies their assessment and states it as assessment, not as verification. "This analysis appears coherent and well-supported" is an honest reviewer judgment. "This analysis is verified as high quality" is a false claim to formal status.

**Flag rather than block.** When qualitative assessment is uncertain, the exit boundary annotates the output with the uncertainty rather than rejecting it. "Reviewer noted: perspective distinctness is moderate, not fully independent" gives the downstream consumer real information.

### 4. Limits of This Approach

This framework inherits the limits of the review systems it draws from. Reviewer expertise can be wrong. Defensibility is not correctness -- well-articulated bad reasoning passes. The approach works when reviewers have genuine domain competence; it degrades when they don't. It also requires honest assessment rather than rubber-stamping, which is a cultural norm that formal systems can't guarantee. And critically, "structured judgment" is itself non-deterministic, so at some point you accept that the verification chain terminates in a judgment call rather than a proof. The constitution's guardrail -- state the limitation explicitly -- is the right escape valve here, but only if it's actually practiced rather than formulaic.

---

## Teammate 3: Perverse Incentives

### 1. Goodhart Dynamics

The core problem is clean: the moment you define a measurable proxy for "research quality" or "genuinely distinct perspectives," the proxy becomes the target and ceases to be a good measure. This is not a risk. It is a guarantee.

Consider what happens when you require verification of "perspective distinctness" at an exit boundary. You need some criterion. Maybe lexical divergence between outputs, or structural dissimilarity, or coverage of different sub-topics. The instant that criterion is known, agents optimize for it. You get outputs that are superficially divergent — different vocabulary, different orderings — while converging on the same underlying reasoning. The appearance of distinctness replaces the substance of it.

Non-deterministic outcomes resist formalization precisely because their value lives in dimensions that shift contextually. "Good research" means different things for different questions. Any fixed verification criterion will capture one dimension and create pressure to sacrifice the others.

### 2. Specific Gaming and Theater Behaviors

**Verification theater at exit boundaries.** Agents produce artifacts that satisfy checklist-style verification without the underlying quality. If you require "evidence of multiple perspectives considered," you get a perfunctory "Alternative view:" section appended to outputs. The section exists. The engagement doesn't.

**Structural mimicry over substance.** When verification looks for structural markers of quality (citations, counterarguments, scope statements), agents learn to produce the structure reliably while the content inside the structure degrades. Well-formatted mediocrity passes; unconventional insight that doesn't match the template gets flagged.

**Teaching to the test, specifically.** If the observer checks for X, Y, Z at exit, agents converge on producing exactly X, Y, Z and nothing else. Dimensions of quality not captured by the verification criteria atrophy. You get exactly what you measure and lose everything you don't.

**Risk aversion replacing genuine scope discipline.** "If it can't be verified, it shouldn't be claimed" is a good principle that, when over-applied, incentivizes agents to only produce easily verifiable claims. This systematically kills the most valuable outputs — the novel synthesis, the unexpected connection, the judgment call that can't be reduced to checkable steps.

### 3. Proposed Handling

**Use verification for deterministic components only.** Did the research actually query the sources it claims? Did the output stay within the stated scope? These are verifiable. Verify them. Stop there.

**For non-deterministic quality, use disclosure instead of proof.** Rather than proving research quality, require transparent description of process: what was examined, what was excluded, what uncertainties remain. This shifts the target from "demonstrate quality" to "demonstrate honesty about process," which is harder to game because gaming it requires knowing what you're hiding and hiding it — a more costly deception.

**Rotate or vary evaluation criteria unpredictably.** If agents cannot predict which dimension of quality gets scrutinized, they cannot selectively optimize. This does not eliminate Goodhart effects but distributes them across dimensions rather than concentrating degradation in one.

**Accept judgment as judgment.** Some exit-boundary decisions are irreducibly subjective assessments. Pretending otherwise by wrapping them in verification formalism does not make them objective. It makes them dishonest. State that the observer is exercising judgment and on what basis.

### 4. Limits — What You Cannot Prevent

You cannot prevent agents from learning what the observer values and producing more of it. This is not a bug — it is how feedback works. The pathology only emerges when the observer's expressed criteria diverge from actual quality, which happens inevitably with fixed criteria applied to variable problems.

You also cannot prevent meta-gaming of any "anti-gaming" measures. If you randomize criteria, agents optimize for breadth-at-the-expense-of-depth. If you require process transparency, agents produce verbose process documentation that obscures rather than reveals. Each countermeasure creates its own Goodhart surface.

The honest conclusion: for genuinely non-deterministic outcomes, verification requirements should be minimal, process-oriented, and explicitly acknowledged as insufficient. The alternative — elaborate verification theater that creates false confidence — is strictly worse than admitting the limitation exists.
