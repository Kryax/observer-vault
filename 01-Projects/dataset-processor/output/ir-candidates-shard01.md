# I(R) Candidate Records — Hybrid Cluster Extraction

**Source:** `output/shard-01.db`  
**K:** 9  
**Total records vectorized:** 3,431  
**Disagreements found:** 861  
**Date:** 2026-04-03 00:54  

## Disagreement Summary

| Pipeline Label → Cluster Axis | Count |
|------|-------|
| integ→diffe | 327 |
| diffe→integ | 284 |
| diffe→recur | 132 |
| integ→recur | 97 |
| recur→diffe | 12 |
| recur→integ | 9 |
| **Total** | **861** |

## Cluster Centroids

| Cluster | Dominant | D | I | R | T | ρ | H | Size |
|---------|----------|---|---|---|---|---|---|------|
| 0 | diffe | 0.301 | 0.282 | 0.145 | 0.520 | 0.171 | 0.569 | 257 |
| 1 | diffe | 0.384 | 0.000 | 0.001 | 0.909 | 0.092 | 0.002 | 414 |
| 2 | integ | 0.001 | 0.640 | 0.001 | 0.736 | 0.150 | 0.004 | 585 |
| 3 | diffe | 0.738 | 0.009 | 0.012 | 0.613 | 0.185 | 0.026 | 363 |
| 4 | diffe | 0.867 | 0.009 | 0.010 | 0.051 | 0.365 | 0.024 | 345 |
| 5 | integ | 0.002 | 0.947 | 0.004 | 0.040 | 0.257 | 0.008 | 385 |
| 6 | recur | 0.007 | 0.012 | 0.463 | 0.848 | 0.112 | 0.036 | 200 |
| 7 | integ | 0.000 | 0.335 | 0.000 | 0.934 | 0.078 | 0.002 | 780 |
| 8 | recur | 0.022 | 0.026 | 0.878 | 0.149 | 0.298 | 0.060 | 102 |

## I(R) Promotion Candidates (pipeline≠recurse, cluster=recurse)

**Count:** 229

These records were classified as differentiate or integrate by Tier A but cluster with recurse-dominant centroids. They are the strongest candidates for axis misclassification.

### Candidate 1: differentiate→recurse

- **ID:** `65fbbdffb26db5ae…`
- **Pipeline axis:** differentiate (tier_a=0.479)
- **Cluster:** 8 (R=95%)
- **Motif:** RB
- **Domain:** USPTO Backgrounds
- **D/I/R vector:** D=3.041 I=0.000 R=3.819
- **Excerpt:**

  > At present, the majority of standardized video coding algorithms are based on hybrid video coding. Hybrid video coding methods typically combine several different lossless and lossy compression schemes in order to achieve the desired compression gain. Hybrid video coding is also the basis for ITU-T standards (H.26x standards such as H.261, H.263) as well as ISO/IEC standards (MPEG-X standards such as MPEG-1, MPEG-2, and MPEG-4). The most recent and advanced video coding standard is currently the

### Candidate 2: differentiate→recurse

- **ID:** `339664918cb07d87…`
- **Pipeline axis:** differentiate (tier_a=0.456)
- **Cluster:** 8 (R=95%)
- **Motif:** TDC
- **Domain:** PhilPapers
- **D/I/R vector:** D=0.000 I=0.000 R=2.822
- **Excerpt:**

  > Working Paper No. 2 Physical Basis for the Emergence of Autopoiesis, Cognition and Knowledge Kororit Institute Working Paper No. 2 – 11/24/2011 ISSN 1839-8855 http://kororoit.org William P. Hall Engineering Learning Unit, School of Engineering, Melbourne University, Vic. 2010, Australia whall@unimelb.edu.au © 2011 William P. Hall Physical Basis for the Emergence of Autopoiesis, Cognition and Knowledge Knowledge is not passively received but actively built up by the cognizing subject (Ernst von G

### Candidate 3: differentiate→recurse

- **ID:** `dca4699ab873b931…`
- **Pipeline axis:** differentiate (tier_a=0.386)
- **Cluster:** 8 (R=95%)
- **Motif:** TDC
- **Domain:** PubMed Central
- **D/I/R vector:** D=0.000 I=0.347 R=1.946
- **Excerpt:**

  > Introduction {#s1} ============  Ginseng (*Panax ginseng* C.A.Mey) has been known as the \"King of Herbs\" since ancient times in eastern Asia ([@B9]). It is a perennial herb that grows in cool habitats and belongs to the Araliaceae family ([@B26]). The root of ginseng been widely used in traditional medicine in eastern Asian countries to promote health ([@B41]). Ginsenosides are the main essential bioactive ingredients that have various pharmacological activities, including anti-inflammatory, a

### Candidate 4: differentiate→recurse

- **ID:** `14b4b20b11fa85ff…`
- **Pipeline axis:** differentiate (tier_a=0.474)
- **Cluster:** 6 (R=96%)
- **Motif:** TDC
- **Domain:** ArXiv
- **D/I/R vector:** D=0.000 I=0.624 R=1.907
- **Excerpt:**

  > --- abstract: |     The exponential growth of volume, variety and velocity of data is raising the need for investigations of automated or semi-automated ways to extract useful patterns from the data. It requires deep expert knowledge and extensive computational resources to find the most appropriate mapping of learning methods for a given problem. It becomes a challenge in the presence of numerous configurations of learning algorithms on massive amounts of data. So there is a need for an intelli

### Candidate 5: integrate→recurse

- **ID:** `47f7b17eb29ef1b0…`
- **Pipeline axis:** integrate (tier_a=0.373)
- **Cluster:** 6 (R=96%)
- **Motif:** PUE
- **Domain:** ArXiv
- **D/I/R vector:** D=0.000 I=0.659 R=1.896
- **Excerpt:**

  > --- abstract: |     We use a conditional Karhunen-Loève (KL) model to quantify and reduce uncertainty in a stochastic partial differential equation (SPDE) problem with partially-known space-dependent coefficient, $Y(x)$. We assume that a small number of $Y(x)$ measurements are available and model $Y(x)$ with a KL expansion. We achieve reduction in uncertainty by conditioning the KL expansion coefficients on measurements. We consider two approaches for conditioning the KL expansion: In Approach 1

### Candidate 6: differentiate→recurse

- **ID:** `0ca651b221a4e292…`
- **Pipeline axis:** differentiate (tier_a=0.368)
- **Cluster:** 8 (R=95%)
- **Motif:** TDC
- **Domain:** PubMed Central
- **D/I/R vector:** D=0.000 I=0.000 R=1.842
- **Excerpt:**

  > 1. Introduction {#s0005} ===============  As exposed by the next-generation sequencing (NGS) techniques, a wide variety of genetic mutations exist in different organisms [@b0190]. Such genetic mutations, particularly missense mutations, can cause proteins to malfunction by modulating their stability as well as altering their affinity with other biological molecules [@b0190], [@b0220], [@b0110], [@b0215]. The stability changes (thermodynamic) upon mutations can be quantified by the change of fold

### Candidate 7: differentiate→recurse

- **ID:** `e8278036ac107760…`
- **Pipeline axis:** differentiate (tier_a=0.368)
- **Cluster:** 8 (R=95%)
- **Motif:** TDC
- **Domain:** PubMed Central
- **D/I/R vector:** D=0.000 I=0.762 R=1.792
- **Excerpt:**

  > The Inhibitor of Growth1 (ING1) tumor suppressor^[@bib1]^ is the founding member of a family of five genes (*ING1--5*) with conserved plant homeodomains (PHDs).^[@bib2]^ ING proteins are implicated in the regulation of cellular senescence,^[@bib3],\ [@bib4],\ [@bib5],\ [@bib6]^ chromatin remodeling,^[@bib7],\ [@bib8],\ [@bib9]^ differentiation,^[@bib10],\ [@bib11]^ DNA damage response,^[@bib12],\ [@bib13],\ [@bib14],\ [@bib15]^ cell cycle regulation^[@bib16],\ [@bib17],\ [@bib18]^ and apoptosis.

### Candidate 8: integrate→recurse

- **ID:** `72c9af39ef473b73…`
- **Pipeline axis:** integrate (tier_a=0.427)
- **Cluster:** 8 (R=95%)
- **Motif:** PUE
- **Domain:** ArXiv
- **D/I/R vector:** D=0.000 I=0.416 R=1.722
- **Excerpt:**

  > --- abstract: 'We introduce a new class of semiparametric latent variable models for long memory discretized event data. The proposed methodology is motivated by a study of bird vocalizations in the Amazon rain forest; the timings of vocalizations exhibit self-similarity and long range dependence ruling out models based on Poisson processes. The proposed class of FRActional Probit (FRAP) models is based on thresholding of a latent process consisting of an additive expansion of a smooth Gaussian

### Candidate 9: integrate→recurse

- **ID:** `3d3f55ed97facb8c…`
- **Pipeline axis:** integrate (tier_a=0.385)
- **Cluster:** 6 (R=96%)
- **Motif:** TAC
- **Domain:** ArXiv
- **D/I/R vector:** D=0.000 I=0.485 R=1.612
- **Excerpt:**

  > --- abstract: '> Active learning holds promise of significantly reducing data annotation costs while maintaining reasonable model performance. However, it requires sending data to annotators for labeling. This presents a possible privacy leak when the training set includes sensitive user data. In this paper, we describe an approach for carrying out privacy preserving active learning with quantifiable guarantees. We evaluate our approach by showing the tradeoff between privacy, utility and annota

### Candidate 10: differentiate→recurse

- **ID:** `94acbd4d95d6161f…`
- **Pipeline axis:** differentiate (tier_a=0.404)
- **Cluster:** 8 (R=95%)
- **Motif:** TDC
- **Domain:** PubMed Central
- **D/I/R vector:** D=0.000 I=0.347 R=1.609
- **Excerpt:**

  > 1. Introduction {#sec1-ijms-21-00751} ===============  Multiple myeloma (MM), which makes up around 10% of all haematological malignancies, is a malignant plasma cell disorder \[[@B1-ijms-21-00751]\]. A major step forward in MM treatment has been the introduction of so-called novel agents, including the immunomodulatory drug (IMID) thalidomide, the subsequent development of its potent analogue lenalidomide, and the first-in-class proteasome inhibitor bortezomib (BZT). These agents serve a variet

### Candidate 11: differentiate→recurse

- **ID:** `b6bfd67960422761…`
- **Pipeline axis:** differentiate (tier_a=0.397)
- **Cluster:** 8 (R=95%)
- **Motif:** RB
- **Domain:** USPTO Backgrounds
- **D/I/R vector:** D=1.178 I=0.000 R=1.609
- **Excerpt:**

  > The present invention relates to video data encoding and decoding, and more particularly relates to the compression and decompression of video data using motion compensated prediction. A schematic diagram of a video coding system using motion compensated prediction is shown in FIG. 1 and FIG. 2 of the accompanying drawings. FIG. 1 illustrates an encoder and FIG. 2 illustrates a corresponding decoder. Motion compensated prediction in such a system is outlined below. In typical video sequences the

### Candidate 12: differentiate→recurse

- **ID:** `858771e6b4bcc91b…`
- **Pipeline axis:** differentiate (tier_a=0.368)
- **Cluster:** 6 (R=96%)
- **Motif:** TDC
- **Domain:** PubMed Central
- **D/I/R vector:** D=0.000 I=0.000 R=1.609
- **Excerpt:**

  > Background {#Sec1} ==========  Regulated cell death (RCD) in the central nervous system (CNS) is a major driver of pathogenesis in neurodegenerative and neuroinflammatory diseases \[[@CR1]\]. Among the twelve types of RCD currently recognized \[[@CR2]\], apoptosis was the first to be identified and has been the most extensively studied in the CNS. During apoptosis, executioner caspases-3 and -7 (-3/7) are cleaved and activated, leading to extensive intracellular proteolysis, disruption of cellul

### Candidate 13: differentiate→recurse

- **ID:** `49b1ff30e4edf05b…`
- **Pipeline axis:** differentiate (tier_a=0.368)
- **Cluster:** 6 (R=96%)
- **Motif:** TDC
- **Domain:** Wikipedia (en)
- **D/I/R vector:** D=0.000 I=0.000 R=1.557
- **Excerpt:**

  > Maria Sibylla Merian  Maria Sibylla Merian (2 April 164713 January 1717) was a German-born naturalist and scientific illustrator, a descendant of the Frankfurt branch of the Swiss Merian family. Merian was one of the first European naturalists to observe insects directly.  Merian received her artistic training from her stepfather, Jacob Marrel, a student of the still life painter Georg Flegel. Merian published her first book of natural illustrations in 1675. She had started to collect insects as

### Candidate 14: integrate→recurse

- **ID:** `17d15e92e3b8b6b1…`
- **Pipeline axis:** integrate (tier_a=0.369)
- **Cluster:** 8 (R=95%)
- **Motif:** TAC
- **Domain:** PubMed Central
- **D/I/R vector:** D=0.624 I=0.000 R=1.462
- **Excerpt:**

  > ###### Strengths and limitations of this study  -   Both the open and percutaneous approach of irreversible electroporation for perihilar cholangiocarcinoma are prospectively investigated.  -   Quality of life of participating patients will be closely observed using validated questionnaires.  -   Strict eligibility criteria may slow the accrual of study participants.  -   The feasibility study design with consequent relative small sample size does not allow for accurate survival analysis.  Intro

### Candidate 15: differentiate→recurse

- **ID:** `1018256b12362adc…`
- **Pipeline axis:** differentiate (tier_a=0.379)
- **Cluster:** 6 (R=96%)
- **Motif:** ESMB
- **Domain:** ArXiv
- **D/I/R vector:** D=0.989 I=0.000 R=1.448
- **Excerpt:**

  > --- abstract: 'This paper draws distinctions among various concepts related to tipping points, robustness, path dependence, and other properties of system dynamics. For each concept a formal definition is provided that utilizes Markov model representations of systems. We start with the basic features of Markov models and definitions of the foundational concepts of system dynamics. Then various tipping point-related concepts are described, defined, and illustrated with a simplified graphical exam

### Candidate 16: integrate→recurse

- **ID:** `9a3bd8b69b83961e…`
- **Pipeline axis:** integrate (tier_a=0.354)
- **Cluster:** 8 (R=95%)
- **Motif:** TAC
- **Domain:** PubMed Central
- **D/I/R vector:** D=0.000 I=0.000 R=1.448
- **Excerpt:**

  > Key Points {#FPar1} ==========  The science of periodization has, for the past seven decades, borrowed substantially from the science of stress to substantiate certain fundamental periodization principles. Yet although stress science has dramatically diverged from its historical roots, periodization theory continually recycles old stress dogma as justification for contemporary doctrine.Fitness adaptations, subsequent to imposed training stressors, are greatly influenced by the neuro- and bio-che

### Candidate 17: differentiate→recurse

- **ID:** `f8b1659401a8d51d…`
- **Pipeline axis:** differentiate (tier_a=0.456)
- **Cluster:** 8 (R=95%)
- **Motif:** TDC
- **Domain:** PubMed Central
- **D/I/R vector:** D=0.555 I=0.000 R=1.433
- **Excerpt:**

  > Introduction ============  Conformational diversity is a key concept for understanding protein function ([@baw038-B1]). Conformers are alternative structures that coexist in a dynamic equilibrium that constitutes the native state of proteins. Structural differences between conformers can be as large as relative movements of subunits or complete domains, or the rearrangements of loops and secondary structural elements ([@baw038-B2]). Structural differences between conformers can be as small as ro

### Candidate 18: differentiate→recurse

- **ID:** `b108884ae3260c34…`
- **Pipeline axis:** differentiate (tier_a=0.368)
- **Cluster:** 6 (R=96%)
- **Motif:** TDC
- **Domain:** PubMed Central
- **D/I/R vector:** D=0.347 I=0.000 R=1.386
- **Excerpt:**

  > Introduction ============  In the past decades, neuroimaging research has been focusing on studying brain function in "resting" conditions, when subjects receive no external stimulation. Functional magnetic resonance imaging (fMRI) resting state connectivity studies stress that the brain at rest is characterized by coherent fluctuations in the blood-oxygen-level-dependent (BOLD) signal. These BOLD fluctuations can be detected in the low frequency range (\<0.1 Hz; Cordes et al., [@B23]), they are

### Candidate 19: differentiate→recurse

- **ID:** `7174cc8eeec004d9…`
- **Pipeline axis:** differentiate (tier_a=0.368)
- **Cluster:** 6 (R=96%)
- **Motif:** TDC
- **Domain:** PubMed Central
- **D/I/R vector:** D=0.000 I=0.555 R=1.386
- **Excerpt:**

  > K1 Auditory scene analysis: support and challenges for predictive coding {#Sec1} ========================================================================  Sue Denham {#Sec2} ----------  ### School of Psychology, Faculty of Health & Human Sciences, Plymouth University, Plymouth, Devon, PL4 8AA, UK {#Sec3}  #### **Correspondence:** Sue Denham (S.Denham\@plymouth.ac.uk) {#Sec4}  *BMC Neuroscience* 2017, **18(Suppl 1)**:K1  Perception seems so simple. I look out of the window to see houses, trees, p

### Candidate 20: differentiate→recurse

- **ID:** `c17f13e52559ccf2…`
- **Pipeline axis:** differentiate (tier_a=0.368)
- **Cluster:** 6 (R=96%)
- **Motif:** TDC
- **Domain:** PubMed Central
- **D/I/R vector:** D=0.485 I=0.000 R=1.386
- **Excerpt:**

  > Introduction ============  TPPII is a 138-kDa serine peptidase found in both cytoplasmic and membrane associated oligomeric complexes of more than 1000 kDa ([@b2-grsb-2008-253]; [@b3-grsb-2008-253]; [@b9-grsb-2008-253]; [@b20-grsb-2008-253]). The assembled enzyme functions as an exopeptidase that removes tripeptides from the free N-terminus of polypeptides ([@b1-grsb-2008-253]; [@b2-grsb-2008-253]; [@b3-grsb-2008-253]; [@b27-grsb-2008-253]), but also exhibits endopeptidase activity towards long

### Candidate 21: integrate→recurse

- **ID:** `35b65ebd272fc8e1…`
- **Pipeline axis:** integrate (tier_a=0.385)
- **Cluster:** 6 (R=96%)
- **Motif:** TAC
- **Domain:** PubMed Central
- **D/I/R vector:** D=0.000 I=0.000 R=1.288
- **Excerpt:**

  > Introduction {#s1} ============  Proteins are dynamical entities whose ability to change shape often plays essential roles in their function. From an experimental point of view, intra-basin dynamics is often described via conformational ensembles whereas larger scale (and often slower) motions are characterized as a conformational exchange between distinct conformational states. The latter are often simplified as a two-site exchange process, $\left. G\rightleftharpoons E \right.$, between a high

### Candidate 22: differentiate→recurse

- **ID:** `093bd76ae99e61d1…`
- **Pipeline axis:** differentiate (tier_a=0.509)
- **Cluster:** 6 (R=96%)
- **Motif:** TDC
- **Domain:** ArXiv
- **D/I/R vector:** D=0.000 I=0.000 R=1.248
- **Excerpt:**

  > --- abstract: 'This work presents a content-based recommender system for machine learning classifier algorithms. Given a new data set, a recommendation of what classifier is likely to perform best is made based on classifier performance over similar known data sets. This similarity is measured according to a data set characterization that includes several state-of-the-art metrics taking into account physical structure, statistics, and information theory. A novelty with respect to prior work is t

### Candidate 23: integrate→recurse

- **ID:** `2dc238caadf71769…`
- **Pipeline axis:** integrate (tier_a=0.400)
- **Cluster:** 8 (R=95%)
- **Motif:** TAC
- **Domain:** Pile-CC
- **D/I/R vector:** D=0.000 I=0.485 R=1.248
- **Excerpt:**

  > " Co-creating and collective intelligence/wisdom are forming a hybrid forces, a calling to reclaim the participation of people in groups as positive, useful, healing, life affirming. We alter the way that we see the world in order to solve problems together.It is a fact that humans today love to participate in problem-solving online, to have a voice and to express themselves, to be a part of the story-telling of new media, and to be a part of the collective intelligence process. The cultural, ec

### Candidate 24: differentiate→recurse

- **ID:** `17c1f051d4c9d2f0…`
- **Pipeline axis:** differentiate (tier_a=0.386)
- **Cluster:** 8 (R=95%)
- **Motif:** TDC
- **Domain:** PubMed Central
- **D/I/R vector:** D=0.000 I=0.000 R=1.178
- **Excerpt:**

  > 1. Introduction {#sec1} ===============  Alzheimer\'s disease (AD), a progressive and irreversible neurodegenerative disorder, contributes to individual morbidity and mortality and burdens the social healthcare system \[[@B1], [@B2]\]. AD has complex neuropathological features, but neurofibrillary tangles consisting of abnormal phosphorylated tau and neuritic amyloid *β* (A*β*) plaques are hallmarks of the disease. The approved medications for AD show consistent but modest clinical effects \[[@B

### Candidate 25: integrate→recurse

- **ID:** `f111b9b58277b8c0…`
- **Pipeline axis:** integrate (tier_a=0.446)
- **Cluster:** 8 (R=95%)
- **Motif:** TAC
- **Domain:** Gutenberg (PG-19)
- **D/I/R vector:** D=0.000 I=0.000 R=1.127
- **Excerpt:**

  > Produced by Paul Murray, Wayne Hammond and the Online Distributed Proofreading Team at http://www.pgdp.net       [Transcriber's Note:  There are two styles of footnotes used in this work:  Footnotes text enclosed in square brackets are by the editor.  Footnotes text not enclosed in square brackets are by the author.  Examples of footnotes:  [Footnote 1: [This note is by the editor]]  [Footnote 2: This note is by the author]]       THE   GREVILLE MEMOIRS   (SECOND PART)    VOL. II.       PRIN

### Candidate 26: differentiate→recurse

- **ID:** `d69e3dc1eebca50e…`
- **Pipeline axis:** differentiate (tier_a=0.421)
- **Cluster:** 6 (R=96%)
- **Motif:** TDC
- **Domain:** PubMed Central
- **D/I/R vector:** D=0.000 I=0.347 R=1.109
- **Excerpt:**

  > Background ==========  Darwin \[[@B1]\] proposed that evolution by natural selection is a gradual process that results in continuous phenotypic variation among species. However, there are many examples where discontinuous phenotypes are observed among related species and thus appear to evolve rapidly. That evolution could suddenly \"leap forward\" led to extensions of Darwin\'s theory to account for the rapid origin of novel phenotypes. One very old idea is that novel and dramatically different

### Candidate 27: differentiate→recurse

- **ID:** `f9d5b085cc9c9484…`
- **Pipeline axis:** differentiate (tier_a=0.474)
- **Cluster:** 8 (R=95%)
- **Motif:** TDC
- **Domain:** PubMed Central
- **D/I/R vector:** D=0.000 I=0.000 R=1.099
- **Excerpt:**

  > BACKGROUND {#s1} ==========  Diclofenac is a nonsteroidal anti-inflammatory drug (NSAID) and an antipyretic commonly used in the treatment of inflammatory disorders, rheumatoid arthritis and chronic pain associated with cancer. Repeatedly it was shown that diclofenac use can be associated with drug induced liver injury \[[@R1]\]. The mechanism by which diclofenac causes liver injury remains incompletely understood. However, some clinical and experimental data have been put forward for an improve

### Candidate 28: integrate→recurse

- **ID:** `308c35ad55ba3d91…`
- **Pipeline axis:** integrate (tier_a=0.415)
- **Cluster:** 6 (R=96%)
- **Motif:** TAC
- **Domain:** PhilPapers
- **D/I/R vector:** D=0.000 I=0.000 R=1.099
- **Excerpt:**

  > Knowledge as a Non-Normative Relation KURT SYLVAN University of Southampton Abstract According to a view I'll call Epistemic Normativism (EN), knowledge is normative in the sense in which paradigmatically normative properties like justification are normative. This paper argues against EN in two stages and defends a positive non-normativist alternative. After clarifying the target in §1, I consider in §2 some arguments for EN from the premise that knowledge entails justification (the "Entailment

### Candidate 29: differentiate→recurse

- **ID:** `e96c04ce0ef9d78c…`
- **Pipeline axis:** differentiate (tier_a=0.404)
- **Cluster:** 6 (R=96%)
- **Motif:** TDC
- **Domain:** PubMed Central
- **D/I/R vector:** D=0.000 I=0.000 R=1.099
- **Excerpt:**

  > Introduction ============  Normal tissues carefully control the production and release of growth-promoting signals. These signals will allow entry and progression through the cell development and division cycle, thereby ensuring cell numbers and thus maintenance of normal tissue architecture and function. Cancer cells, by deregulating these signals, permit chronic proliferation. The G1/S checkpoint controls progression of cells through the restriction point into the DNA synthesis S-phase. The p1

### Candidate 30: differentiate→recurse

- **ID:** `1836c0eb55f41962…`
- **Pipeline axis:** differentiate (tier_a=0.404)
- **Cluster:** 8 (R=95%)
- **Motif:** TDC
- **Domain:** PubMed Central
- **D/I/R vector:** D=0.000 I=0.000 R=1.099
- **Excerpt:**

  > Introduction {#s1} ============  Hepatocellular carcinoma (HCC) is a type of primary liver malignancy that typically occurs in the context of chronic liver inflammation and is the most common cause of cancer-related deaths worldwide ([@B13]). The clinical characteristics of HCC include abdominal pain, weight loss, and a large mass in the upper right part of the abdomen. While the etiology of HCC is not fully elucidated, there is a consensus that the main risk factors of HCC seem to be associated

### Candidate 31: differentiate→recurse

- **ID:** `7cf9b9a9ab61bc6d…`
- **Pipeline axis:** differentiate (tier_a=0.404)
- **Cluster:** 6 (R=96%)
- **Motif:** TDC
- **Domain:** PubMed Central
- **D/I/R vector:** D=0.000 I=0.416 R=1.099
- **Excerpt:**

  > INTRODUCTION {#s1} ============  The eukaryotic translation elongation factor 1A (eEF1A) is one of the most abundant proteins in the cell, accounting for between 3 and 10% of all soluble protein ([@JCS192831C28]). It is an essential translation elongation factor which, when bound to GTP delivers aminoacylated-tRNA to the A site of the ribosome. The interaction between mRNA and cognate tRNA within the A site of the ribosome activates the GTPase activity of eEF1A leading to the release of its amin

### Candidate 32: differentiate→recurse

- **ID:** `4305ef2e73422978…`
- **Pipeline axis:** differentiate (tier_a=0.404)
- **Cluster:** 6 (R=96%)
- **Motif:** TDC
- **Domain:** PubMed Central
- **D/I/R vector:** D=0.000 I=0.000 R=1.099
- **Excerpt:**

  > Human cancers are highly diverse, exhibit complex aetiology, and remain extremely challenging to treat in the clinic. As the total burden of disease and associated healthcare costs continue to rise, attention is now increasingly turning to methods of cancer prevention rather than cure[@b1][@b2]. Various epidemiological studies have suggested that a promising approach could be to increase consumption of naturally-occurring bioactive dietary compounds (BDCs) which have been reported to modulate th

### Candidate 33: differentiate→recurse

- **ID:** `f6f6002203160405…`
- **Pipeline axis:** differentiate (tier_a=0.386)
- **Cluster:** 6 (R=96%)
- **Motif:** TDC
- **Domain:** PubMed Central
- **D/I/R vector:** D=0.347 I=0.000 R=1.099
- **Excerpt:**

  > Introduction {#s1} ============  Uveal melanoma (UM) is an intraocular malignant tumor occurring mainly in adult Caucasian and originates from melanocytes of the choroid, iris, and ciliary body [@pone.0016516-Singh1], [@pone.0016516-Peter1]. Most of UMs (95%) are posterior UM (locating in the ciliary body and choroid). Over a 25-year period from 1973 to 1997, incidence of UM in the United State has been determined to be 4.3 cases per million people per year, which is similar to the report from E

### Candidate 34: differentiate→recurse

- **ID:** `1767ffcd27ccfd49…`
- **Pipeline axis:** differentiate (tier_a=0.386)
- **Cluster:** 6 (R=96%)
- **Motif:** TDC
- **Domain:** PubMed Central
- **D/I/R vector:** D=0.000 I=0.000 R=1.099
- **Excerpt:**

  > The proteomics data have been deposited to the ProteomeXchange Consortium (<http://proteomecentral.proteomexchange.org>) via the PRIDE partner repository with the dataset identifier PXD004104. Transcriptomics data are available in the ArrayExpress database (<http://www.ebi.ac.uk/arrayexpress>) under accession number E-MTAB-4720.  Introduction {#sec001} ============  The central dogma of molecular biology states that genetic information generally flows from DNA through RNA to proteins \[[@pone.01

### Candidate 35: differentiate→recurse

- **ID:** `f819b9cbc489de20…`
- **Pipeline axis:** differentiate (tier_a=0.368)
- **Cluster:** 6 (R=96%)
- **Motif:** TDC
- **Domain:** PubMed Central
- **D/I/R vector:** D=0.000 I=0.347 R=1.099
- **Excerpt:**

  > The association of altered plasma lipids with coronary heart disease (CHD) risk has been known for decades, however, for some CHD-risk single nucleotide polymorphisms (SNPs), there is no association with traditional lipid measurements, such as lipoproteins (HDL \[high-density lipoprotein\] or LDL \[low-density lipoprotein\]) or their constituents: cholesteryl esters and triglycerides.^[@R1]^ As a prominent example, the relatively common *CDKN2A/2B* (rs10757274, A\>G; minor allele frequency =0.48

### Candidate 36: differentiate→recurse

- **ID:** `f41a6d7378671096…`
- **Pipeline axis:** differentiate (tier_a=0.368)
- **Cluster:** 6 (R=96%)
- **Motif:** TDC
- **Domain:** PubMed Central
- **D/I/R vector:** D=0.000 I=0.000 R=1.099
- **Excerpt:**

  > Introduction {#S0001} ============  Chronic obstructive pulmonary disease (COPD) is characterized by persistent, DNA damage-mediated chronic inflammation in the lung, leading to tissue remodelling, alveolar destruction, airflow limitation and accelerated decline in lung function \[[1](#CIT0001)\]. Cigarette smoking is the main risk factor for this debilitating disease, while exposure to other environmental factors, noxious gases, indoor and outdoor air pollution (biomass fuel) and occupational d

### Candidate 37: integrate→recurse

- **ID:** `f36e7c17ef1ea165…`
- **Pipeline axis:** integrate (tier_a=0.359)
- **Cluster:** 8 (R=95%)
- **Motif:** SCGS
- **Domain:** PhilPapers
- **D/I/R vector:** D=0.000 I=0.000 R=1.099
- **Excerpt:**

  > Bibliography Barrow, John D. . Pi in the Sky: Counting, Thinking and Being. Little, Brown & Company 1992 Bell, J.L Toposes and Local Set Theories, an Introduction. Dover Publications, 1988 Benacerraf, P., and H. Putnam, eds. []: Philosophy of Mathematics. 2nd Ed Cambridge University Press. 1983 Birkhoff, Garrett and Mac Lane, Saunders A Survey of Modern Algebra Macmillan Company 1955 Bohr, Niels. Transcript of Tape-Recorded Interview of Niels Bohr by Thomas S. Kuhn, Leon Rosenfeld, Aage Petersen

### Candidate 38: integrate→recurse

- **ID:** `e208f903a3319e60…`
- **Pipeline axis:** integrate (tier_a=0.538)
- **Cluster:** 6 (R=96%)
- **Motif:** TAC
- **Domain:** Pile-CC
- **D/I/R vector:** D=0.000 I=0.485 R=1.040
- **Excerpt:**

  > Sample records for external control parameter  Full Text Available This paper addresses the end-effector position and orientation tracking problem of a 6-degrees of freedom (DOF rigid link electrically driven (RLED revolute joint serial robot manipulator with uncertain parameters and external disturbances. System uncertainties and external disturbances are bounded but their upper limits are unknown. The input matrix, which is always invertible and not necessarily a diagonal matrix, is also assum

### Candidate 39: integrate→recurse

- **ID:** `a4ba772ac6610b3c…`
- **Pipeline axis:** integrate (tier_a=0.492)
- **Cluster:** 6 (R=96%)
- **Motif:** TAC
- **Domain:** PubMed Central
- **D/I/R vector:** D=0.000 I=0.000 R=1.040
- **Excerpt:**

  > Significance Statement {#s1} ======================  To measure metacognition, or the ability to monitor one's own thoughts, experimental tasks often require human volunteers to, first, make a perceptual decision ("first-order task") and, then, rate their confidence in their own decision ("second-order task"). In this paradigm, both first-order and second-order information could, in principle, influence confidence judgments. But only the latter is truly metacognitive. To determine whether confid

### Candidate 40: integrate→recurse

- **ID:** `753c6d7e6699d571…`
- **Pipeline axis:** integrate (tier_a=0.400)
- **Cluster:** 6 (R=96%)
- **Motif:** TAC
- **Domain:** PubMed Central
- **D/I/R vector:** D=0.000 I=0.000 R=1.040
- **Excerpt:**

  > The content published in Cureus is the result of clinical experience and/or research by independent individuals or organizations. Cureus is not responsible for the scientific accuracy or reliability of data or conclusions published herein. All content published within Cureus is intended only for educational, research and reference purposes. Additionally, articles published within Cureus should not be deemed a suitable substitute for the advice of a qualified health care professional. Do not disr

### Candidate 41: differentiate→recurse

- **ID:** `633702d23b40cf78…`
- **Pipeline axis:** differentiate (tier_a=0.438)
- **Cluster:** 8 (R=95%)
- **Motif:** RB
- **Domain:** Pile-CC
- **D/I/R vector:** D=0.000 I=0.000 R=0.989
- **Excerpt:**

  > DESCRIPTION  Introduction SoX reads and writes audio files in most popular formats and can optionally apply effects to them. It can combine multiple input sources, synthesise audio, and, on many systems, act as a general purpose audio player or a multi-track audio recorder. It also has limited ability to split the input into multiple output files.  All SoX functionality is available using just the sox command. To simplify playing and recording audio, if SoX is invoked as play, the output file is

### Candidate 42: integrate→recurse

- **ID:** `a57d80b205d30363…`
- **Pipeline axis:** integrate (tier_a=0.385)
- **Cluster:** 6 (R=96%)
- **Motif:** TAC
- **Domain:** PhilPapers
- **D/I/R vector:** D=0.000 I=0.000 R=0.989
- **Excerpt:**

  > Delft University of Technology Reflections on the Reversibility of Nuclear Energy Technologies Bergen, Jan DOI 10.4233/uuid:03d807bf-9dca-4ff2-a797-8521227625e2 Publication date 2017 Document Version Final published version Citation (APA) Bergen, J. (2017). Reflections on the Reversibility of Nuclear Energy Technologies. https://doi.org/10.4233/uuid:03d807bf-9dca-4ff2-a797-8521227625e2 Important note To cite this publication, please use the final published version (if applicable). Please check t

### Candidate 43: differentiate→recurse

- **ID:** `7317ec962f490a59…`
- **Pipeline axis:** differentiate (tier_a=0.384)
- **Cluster:** 6 (R=96%)
- **Motif:** RB
- **Domain:** ArXiv
- **D/I/R vector:** D=0.000 I=0.000 R=0.989
- **Excerpt:**

  > --- abstract: 'When a mobile hole is moving in an anti-ferromagnet it distorts the surrounding Néel order and forms a magnetic polaron. Such interplay between hole motion and anti-ferromagnetism is believed to be at the heart of high-temperature superconductivity in cuprates. In this article we study a single hole described by the $t-J_z$ model with Ising interactions between the spins in two dimensions. This situation can be experimentally realized in quantum gas microscopes with Mott insulator

### Candidate 44: differentiate→recurse

- **ID:** `27c6e9ab994523bd…`
- **Pipeline axis:** differentiate (tier_a=0.456)
- **Cluster:** 6 (R=96%)
- **Motif:** TDC
- **Domain:** PhilPapers
- **D/I/R vector:** D=0.000 I=0.000 R=0.970
- **Excerpt:**

  > Indexicals as Token-Reflexives MANUEL GARCIA-CARPINTERO Reichenbachian approaches to indexicality contend that indexicals are "token -reflexives": semantic rules associated with any given indexical-type determine the truth-conditional import of properly produced tokens of that type relative to certain relational properties of those tokens. Such a view may be understood as sharing the main tenets of Kaplan's well-known theory regarding content, or truth-conditions, but differs from it regarding t

### Candidate 45: integrate→recurse

- **ID:** `b3622cdbb63c79cc…`
- **Pipeline axis:** integrate (tier_a=0.400)
- **Cluster:** 6 (R=96%)
- **Motif:** TAC
- **Domain:** FreeLaw
- **D/I/R vector:** D=0.000 I=0.000 R=0.970
- **Excerpt:**

  > 998 P.2d 833 (2000) 140 Wash.2d 475 In the Matter of the DISCIPLINARY PROCEEDING AGAINST Lowell K. HALVERSON, an Attorney at Law. No. 01518-0. Supreme Court of Washington, En Banc. Argued October 14, 1999. Decided April 27, 2000. *836 David Allen, Seattle, for Petitioner. Andrea A. Darvas, Washington State Bar Disciplinary Counsel, Seattle, for Respondent. *834 *835 IRELAND, J. In this Washington State Bar Association (WSBA) disciplinary case, this Court must determine (1) whether the WSBA Disc

### Candidate 46: differentiate→recurse

- **ID:** `f1868b633fa0db2f…`
- **Pipeline axis:** differentiate (tier_a=0.368)
- **Cluster:** 8 (R=95%)
- **Motif:** TDC
- **Domain:** PubMed Central
- **D/I/R vector:** D=0.549 I=0.000 R=0.970
- **Excerpt:**

  > 1. Introduction {#s0005} ===============  Alzheimer\'s disease (AD) is a neurodegenerative disorder characterized by the presence of AD pathology (ADP) such as aberrant deposition of amyloid beta (A*β*) proteins, and the appearance of neurofibrillary tangles of tau proteins. The initial symptom of AD is cognitive impairment notably in the memory domain, that gradually involves other domains leading to a clinical diagnosis of dementia of Alzheimer\'s type (DAT). Patients with DAT progressively su

### Candidate 47: differentiate→recurse

- **ID:** `a978a6aab7cdfb47…`
- **Pipeline axis:** differentiate (tier_a=0.356)
- **Cluster:** 6 (R=96%)
- **Motif:** ESMB
- **Domain:** ArXiv
- **D/I/R vector:** D=0.000 I=0.000 R=0.970
- **Excerpt:**

  > \ \ [Computer Science Department, Aalborg University\ Fr. Bajersvej 7E; 9200 Aalborg, Denmark\ manthey@cs.auc.dk]{}\ ©.  -   [**Abstract**]{}. This paper presents a new distributed computational model of distributed systems called the [*phase web*]{} that extends Vaughn Pratt’s orthocurrence relation from 1986. The model uses mutual-exclusion to express sequence, and a new kind of hierarchy to replace event sequences, posets, and pomsets. The model explicitly connects computation to a discrete C

### Candidate 48: differentiate→recurse

- **ID:** `9ba848172e4561fa…`
- **Pipeline axis:** differentiate (tier_a=0.411)
- **Cluster:** 8 (R=95%)
- **Motif:** HSSFS
- **Domain:** Pile-CC
- **D/I/R vector:** D=0.000 I=0.000 R=0.879
- **Excerpt:**

  > The ferroelectric degenerate semiconductor Sn{sub 1-{delta}}Te exhibits superconductivity with critical temperatures, T{sub c}, of up to 0.3 K for hole densities of order 10{sup 21} cm{sup -3}. When doped on the tin site with greater than x{sub c} = 1.7(3)% indium atoms, however, superconductivity is observed up to 2 K, though the carrier density does not change significantly. We present specific heat data showing that a stronger pairinginteraction is present for x > x{sub c} than for x < x{sub

### Candidate 49: integrate→recurse

- **ID:** `3da8a825e1e76309…`
- **Pipeline axis:** integrate (tier_a=0.369)
- **Cluster:** 6 (R=96%)
- **Motif:** TAC
- **Domain:** PubMed Central
- **D/I/R vector:** D=0.000 I=0.000 R=0.879
- **Excerpt:**

  > The NetSense data is attached as [S1 File](#pone.0233458.s003){ref-type="supplementary-material"}. The NetHealth data are now publicly online at <http://sites.nd.edu/nethealth>.  Introduction {#sec001} ============  An individual's political orientation reflects his or her relative position or standing on a liberal-conservative (left-right) spectrum \[[@pone.0233458.ref001]--[@pone.0233458.ref003]\]. In a classic statement, the political scientist Philip Converse theorizes that political orienta

### Candidate 50: integrate→recurse

- **ID:** `94e94a0687a09716…`
- **Pipeline axis:** integrate (tier_a=0.354)
- **Cluster:** 6 (R=96%)
- **Motif:** TAC
- **Domain:** Pile-CC
- **D/I/R vector:** D=0.000 I=0.000 R=0.879
- **Excerpt:**

  > It's come to my attention that some people think UR has a bad attitude. That it wallows in decadent, aestheticized despair under the inexorable velvet grip of the Polygon, pausing only to scoff at the feeble struggles of those deluded fools who call themselves the "resistance."  Au contraire, mon frere. Well, okay, I do scoff. But I also offer serious, positive proposals for a freer and happier tomorrow. Here's one for this beautiful spring weekend.  I believe (and I think everyone should believ


## Other Axis Disagreements

**Count:** 632

### integrate→differentiate (327 records)

- `70cf7f9fccf27682…` | tier_a=0.554 | motif=TAC | Pile-CC
  D=0.000 I=1.040 R=0.970
  > We bear the consequences of the judgement passed against Adam. We are separated from God and devoid of the indwelling Holy Spirit and left to our natural mortality we are experiencing dissolution.  Ho…

- `09fef1dc351e25a8…` | tier_a=0.413 | motif=PUE | ArXiv
  D=0.000 I=1.109 R=0.693
  > --- abstract: 'This paper introduces a new probabilistic model for online learning which dynamically incorporates information from stochastic gradients of an arbitrary loss function. Similar to probab…

- `124906aede68babb…` | tier_a=0.400 | motif=TAC | Pile-CC
  D=0.000 I=0.485 R=0.693
  > If you buy something through our links, ToolGuyd might earn an affiliate commission.  I just got off the phone with someone who recently stepped into a leadership position at Sears. It sounds like he …

- `8e017004554a8b17…` | tier_a=0.369 | motif=TAC | Pile-CC
  D=0.000 I=0.416 R=0.659
  > Tuesday, October 28, 2014  Coincidences abound. Last night I gave a lecture to my Cost-Benefit Analysis class on uncertainty and precaution, and this morning I see a writeup of a new article by Nassim…

- `4c0788fe44d3db92…` | tier_a=0.431 | motif=TAC | Wikipedia (en)
  D=0.000 I=0.769 R=0.624
  > Structured expert judgment: the classical model  Expert Judgment (EJ) denotes a wide variety of techniques ranging from a single undocumented opinion, through preference surveys, to formal elicitation…

- `217598b93ddf1473…` | tier_a=0.585 | motif=TAC | Pile-CC
  D=0.000 I=0.769 R=0.555
  > Friday, March 27, 2015  Deconstructing the 97% self-destructed Richard Tol  If you're a mediocre academic who yearns to be in the spotlight, what do you do? If you've burnt your bridges academically a…

- `c0f98580a16632f9…` | tier_a=0.453 | motif=PUE | ArXiv
  D=0.000 I=0.901 R=0.555
  > --- abstract: 'Recent advances in Markov chain Monte Carlo (MCMC) extend the scope of Bayesian inference to models for which the likelihood function is intractable. Although these developments allow u…

- `93afd11130848df8…` | tier_a=0.446 | motif=TAC | Pile-CC
  D=0.624 I=0.000 R=0.555
  > In Democratic Individuality, I argued that at a high level of abstraction, modern conservatives, liberals and radicals believe that the best economic, social and political institutions foster each per…

- `1bcb2b816398eec9…` | tier_a=0.446 | motif=TAC | Pile-CC
  D=0.000 I=0.485 R=0.555
  > What is the currency of change? What can coders (consumers) do with IATI data? How can suppliers deliver the data sets? Last week I had the honour of participating in the Open Data for Development Cod…

- `1634428fc2e5233b…` | tier_a=0.413 | motif=PUE | ArXiv
  D=0.000 I=0.439 R=0.555
  > --- abstract: 'The amplitude of the ionizing background that pervades the intergalactic medium (IGM) at the end of the epoch of reionization provides a valuable constraint on the emissivity of the sou…

  *…and 317 more*

### differentiate→integrate (284 records)

- `a5a2ac0d42c83de7…` | tier_a=0.370 | motif=RB | ArXiv
  D=0.000 I=1.802 R=0.693
  > --- abstract: |     Many large scale problems in computational fluid dynamics such as uncertainty quantification, Bayesian inversion, data assimilation and PDE constrained optimization are considered …

- `1c7dd65f7a1fe23f…` | tier_a=0.474 | motif=TDC | PubMed Central
  D=0.000 I=0.832 R=0.555
  > Introduction {#s1} ============  The ability of organisms to rapidly adapt to new environments can be both facilitated and constrained by the underlying molecular basis and mechanisms operating at the…

- `5d2204790f6b4884…` | tier_a=0.368 | motif=TDC | PubMed Central
  D=0.000 I=1.109 R=0.485
  > Background {#Sec1} ==========  Over the last decade, major research advances in genome sequencing (i.e. "DNA reading") are slowly being matched by advances in synthetic biology (i.e. "DNA writing") \[…

- `2079ca28670b0bf6…` | tier_a=0.789 | motif=TDC | PubMed Central
  D=0.000 I=0.485 R=0.000
  > Background ==========  Protein kinases are the most ubiquitous family of signaling molecules in human cells, accounting for approximately 2% of the proteins encoded by the human genome \[[@B1]\]. They…

- `793e4bcb379aaf88…` | tier_a=0.705 | motif=CPA | Ubuntu IRC
  D=0.000 I=0.416 R=0.000
  > #ubuntu-motu 2006-03-13 <LaserJock> raphink: you still up? <raphink> yep <raphink> sure <LaserJock> what time is it there? <raphink> building a fix for kontact <raphink> it's 00:21 <raphink> I'm often…

- `e1fa8acc74b790cb…` | tier_a=0.705 | motif=CPA | Ubuntu IRC
  D=0.000 I=0.832 R=0.000
  > #ubuntu-devel 2005-06-20 <pepsi> https://bugzilla.ubuntu.com/show_bug.cgi?id=11758 <pepsi> ? <KaiL_> if I read that error correctly, the folder must exist, not be removed <pepsi> it already exists <Ka…

- `aba4617339bee973…` | tier_a=0.702 | motif=TDC | PubMed Central
  D=0.000 I=0.416 R=0.000
  > **Imprint**  **ISSN Print Edition: 1662-4025**  **ISSN Online Edition: 1662-4033**  **Journal Homepage:** <http://www.karger.com/ofa>  **Publication Data:** Volume 8, 2015 of  '[Obesity Facts]{.smallc…

- `b6c141a983c025a6…` | tier_a=0.659 | motif=CPA | Ubuntu IRC
  D=0.000 I=1.539 R=0.000
  > #launchpad 2005-07-18 <kiko> bradb, well, it currently tracebacks, and that's pretty bad <bradb> kiko: right, i'll file a bug on that. thanks for pointing it out. <bradb> salgado: i'll file a bug on t…

- `1ac82bafa715cc47…` | tier_a=0.649 | motif=TDC | PhilPapers
  D=0.000 I=0.416 R=0.000
  > PURDUE UNIVERSITY GRADUATE SCHOOL Thesis Acceptance This is to certify that the thesis prepared By Entitled Complies with University regulations and meets the standards of the Graduate School for orig…

- `0dcc1c78fd25c70c…` | tier_a=0.636 | motif=CPA | ArXiv
  D=0.000 I=0.485 R=0.000
  > --- abstract: 'The Internet of Things (IoT) is emerging as the next big wave of digital presence for billions of devices on the Internet. Smart Cities are practical manifestation of IoT, with the goal…

  *…and 274 more*

### recurse→differentiate (12 records)

- `02a77adec2dd317f…` | tier_a=0.662 | motif=PEPS | PhilPapers
  D=1.178 I=0.416 R=1.941
  > Bibliography Adams, Rick A, Stewart Shipp, and Karl Friston (2013). "Predictions not commands: active inference in the motor system". In: Brain Structure and Function 218.3, pp. 611–643. Agnati, Luigi…

- `b79eac961a5c0252…` | tier_a=0.437 | motif=PEPS | PubMed Central
  D=0.000 I=0.989 R=1.386
  > The present eye movement study investigated the role of predicting upcoming words during silent reading and the potential differences between fast and slow readers in this cognitive process. We plunge…

- `5342b55d2584231a…` | tier_a=0.403 | motif=RST | PubMed Central
  D=0.000 I=0.549 R=1.109
  > All relevant data are within the paper and its Supporting Information files.  Introduction {#sec001} ============  In animals, the amount of juvenile growth is controlled by the coordinated timing of …

- `09fd82be07035c91…` | tier_a=0.400 | motif=PEPS | PhilPapers
  D=0.549 I=0.000 R=0.693
  > Palmer et al. 'Movement under uncertainty'. Accepted for publication in Neuropsychologia Movement under uncertainty: The effects of the rubber-hand illusion vary along the nonclinical autism spectrum.…

- `213f80253bf35bf6…` | tier_a=0.468 | motif=RST | PhilPapers
  D=2.236 I=0.000 R=0.555
  > THE CIVILIZATION AT A CROSSROADS: CONSTRUCTING THE PARADIGM SHIFT Gennady Shkliarevsky Copyright and related rights for this work have been waived via CC0 1.0 Universal Public Domain Dedication. To vi…

- `3234fc3deb19785c…` | tier_a=0.378 | motif=NSSH | PhilPapers
  D=1.288 I=0.000 R=0.555
  > From physics to biology by extending criticality and symmetry breakings* Giuseppe Longo†, Maël Montévil‡ 2011 Abstract Symmetries play a major role in physics, in particular since the work by E. Noeth…

- `5798a32f9f5062cc…` | tier_a=0.459 | motif=PSR | Pile-CC
  D=0.555 I=0.000 R=0.416
  > Metaphysics is a branch of "philosophy exploring the fundamental questions, including the nature of concepts like "being, "existence, and "reality.[1] It has two branches – "cosmology and "ontology. T…

- `0b34f04e42c5ca10…` | tier_a=0.561 | motif=NSSH | PhilPapers
  D=0.000 I=0.485 R=0.347
  > page 1 of 36 1 Some resonances between Eastern thought and Integral Biomathics in the framework of the WLIMES formalism for modelling living systems Plamen L. Simeonov Charité Universitätsmedizin, Ber…

- `32919d92f783983c…` | tier_a=0.549 | motif=NSSH | PubMed Central
  D=1.594 I=0.000 R=0.000
  > Many biological, physiological, and psychological phenomena display time evolving dynamics among their governing processes. Very often these dynamics are straightforwardly observable, as in the back-a…

- `fa5257e43361bbef…` | tier_a=0.543 | motif=OFL | PhilPapers
  D=0.555 I=0.000 R=0.000
  > Journal of Consciousness Exploration & Research| April 2010 | Vol. 1 | Issue 3 | Page 213-401 ISSN: 2153-8212 Journal of Consciousness Exploration & Research Published by QuantumDream, Inc. www.JCER.c…

  *…and 2 more*

### recurse→integrate (9 records)

- `762326c422c8e1cf…` | tier_a=0.403 | motif=RST | USPTO Backgrounds
  D=0.000 I=0.347 R=0.555
  > Cell division, in both normal and neoplastic cells, is a tightly controlled event which occurs by defined stages. Quiescent cells which are not actively dividing, are in the G0 phase, as are those ter…

- `5c173014f0cbd674…` | tier_a=0.775 | motif=PEPS | PhilPapers
  D=0.000 I=1.144 R=0.000
  > Chapter 1 Cognitive Systems "One might say that cognitive science has a very long past but a relatively short history." (Gardner, 1985) As discussed in the introduction, the focus of this thesis is de…

- `5f1fbea56cc592c3…` | tier_a=0.500 | motif=PEPS | PubMed Central
  D=0.000 I=0.555 R=0.000
  > Introduction ============  Although there have been tremendous advances in the development of algorithms and devices that can extract meaningful information from their environment, we seem still far a…

- `768a552ac929519a…` | tier_a=0.450 | motif=PEPS | PubMed Central
  D=0.000 I=0.555 R=0.000
  > All relevant data are within the paper and its Supporting Information files.  Introduction {#sec001} ============  Standard theories of decision-making assume that the incentive value of an option sho…

- `88d321f467e00897…` | tier_a=0.416 | motif=RST | PubMed Central
  D=0.000 I=1.364 R=0.000
  > Introduction ============  The maternally transmitted alfa-Proteobacterium *Wolbachia pipientis* (Rickettsiales) is a widespread endosymbiont of filarial nematodes and arthropods, including crustacean…

- `e31d55f5fef48965…` | tier_a=0.375 | motif=PEPS | PubMed Central
  D=0.000 I=0.485 R=0.000
  > What makes social decision-making unique and different from non-social decision-making? Humans are highly social animals---as such, researchers often take for granted the ease with which humans make s…

- `3f07b462792a8e88…` | tier_a=0.375 | motif=PEPS | PhilPapers
  D=0.000 I=0.485 R=0.000
  > HYBRIS nr 38 (2017) ISSN: 1689-4286 KATARZYNA KOBOS WHAT DOES THE SENSORY APPARATUS DO WHEN THERE IS NOTHING TO PERCEIVE? THE SALIENCE OF SENSORY ABSENCE An adequate and exhaustive explanation of the …

- `c0f35762c314e42c…` | tier_a=0.365 | motif=PSR | ArXiv
  D=0.000 I=1.144 R=0.000
  > --- abstract: |     The Dirichlet series of $\zeta(s)$ was long ago proven to be divergent throughout half-plane $\text{Re}(s)\le1$. If also Riemann’s proposition is true, that there exists an “expres…

- `816da91b77b43de9…` | tier_a=0.362 | motif=PEPS | PubMed Central
  D=0.000 I=0.555 R=0.000
  > Introduction {#s1} ============  Decision making is a complex process by which an organism must weigh multiple possible outcomes against current and long term goals before deciding on a course of acti…

