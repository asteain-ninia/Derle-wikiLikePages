# Literature sources for the WorldSmith (v8.0) relations

Research date: 2026-11-07. Scope: where each relation comes from, whether the sheet's constants match the source, and what newer relation to use instead. Nothing from the spreadsheet is reproduced here beyond the formula summaries given in the brief.

Legend: **VERIFIED** = checked against the paper or an official file/abstract during this session. **PARTIAL** = bibliographic data verified, but the exact equation or page only via a secondary source. **UNVERIFIED** = from memory or a secondary source only. **AD HOC** = no literature source found.

---

## 1. Main-sequence mass–luminosity relation

**Sheet:** L = 0.23 M^2.3 (M<0.43); M^4 (0.43–2); 1.4 M^3.5 (M≥2).

**Source (PARTIAL):** This is the piecewise form in Wikipedia's "Mass–luminosity relation" article, copied exactly. It cites:
- Duric, N. (2004). *Advanced Astrophysics*. Cambridge University Press, p. 19. ISBN 978-0-521-52571-8.
- Salaris, M. & Cassisi, S. (2005). *Evolution of Stars and Stellar Populations*. Wiley, pp. 138–140. ISBN 978-0-470-09220-0.
- a JILA lecture PDF ("The Eddington Limit, Lecture 18", 2003).

I could not check the book pages, so whether Duric's p. 19 has these exact coefficients is **UNVERIFIED**.

**Match:** The coefficients match the Wikipedia/Duric form. Differences:
- The source has a fourth branch, L ≈ 32000 M for M > 55 M☉. The sheet leaves it out.
- The source gives the 1.4 M^3.5 branch as 2–55 M☉, not open-ended.
- The fit is not continuous at the breaks: 0.0330 vs 0.0342 at 0.43 M☉ (~4%), and 16.0 vs 15.84 at 2 M☉ (~1%).

It is a pedagogical approximation, not a fit to a defined data set.

**Newer/better (VERIFIED):** Eker, Z. et al. (2018). "Interrelated main-sequence mass–luminosity, mass–radius, and mass–effective temperature relations." *MNRAS* 479, 5491–5511. doi:10.1093/mnras/sty1834, arXiv:1807.02568.
- Data: 509 detached double-lined eclipsing-binary components, fitted as six pieces of the form log L = a log M + b.

| Mass range (M☉) | a | b |
|---|---|---|
| 0.179–0.45 | 2.028 ± 0.135 | −0.976 ± 0.070 |
| 0.45–0.72 | 4.572 ± 0.319 | −0.102 ± 0.076 |
| 0.72–1.05 | 5.743 ± 0.413 | −0.007 ± 0.026 |
| 1.05–2.40 | 4.329 ± 0.087 | +0.010 ± 0.019 |
| 2.4–7 | 3.967 ± 0.143 | +0.093 ± 0.083 |
| 7–31 | 2.865 ± 0.155 | +1.105 ± 0.176 |

(The text of the paper gives 2.868 for the last slope; Table 4 gives 2.865.)

**Theory-based alternative (VERIFIED, bibliographic):** Tout, C. A., Pols, O. R., Eggleton, P. P. & Han, Z. (1996). "Zero-age main-sequence radii and luminosities as analytic functions of mass and metallicity." *MNRAS* 281, 257–262. ADS: https://ui.adsabs.harvard.edu/abs/1996MNRAS.281..257T
- Covers ZAMS L(M,Z) and R(M,Z) for 0.1–100 M☉ and Z = 0.0001–0.03.
- Errors are below 3% (L) and 1.2% (R) at Z = 0.02.
- Recommended if the tool wants smooth, continuous functions with metallicity.

## 2. Main-sequence mass–radius relation

**Sheet:** R = M^0.8 (M<1), M^0.57 (M≥1).

**Source:** The exponents ~0.8 below 1 M☉ and ~0.57 above appear in lecture notes without a citation, e.g. H. Schatz, MSU PHY983 "main_sequence" lecture: "really exponent is ~0.8 for M<M_sol, 0.57 for M>M_sol" (https://people.frib.msu.edu/~schatz/PHY983_13/Lectures/main_sequence.pdf).
- They are commonly traced to Kippenhahn & Weigert, *Stellar Structure and Evolution* (Springer 1990; 2nd ed. Kippenhahn, Weigert & Weiss 2012), in the main-sequence chapter. That attribution and the page are **UNVERIFIED**.
- Wikipedia's "Main sequence" article gives a single R ∝ M^0.78 (St Andrews lecture notes).

**Demircan & Kahraman 1991 does not match.** Demircan, O. & Kahraman, G. (1991). "Stellar mass-luminosity and mass-radius relations." *Ap&SS* 181, 313–322. doi:10.1007/BF00639097.
- Its abstract puts the MRR slope change near 1.7 M☉, not at 1 M☉.
- Its exponents near 1 M☉ are about 0.9–0.95, not 0.8. The exact coefficients (often quoted as R = 1.06 M^0.945 for M<1.66 and 1.33 M^0.555 for M>1.66) are **UNVERIFIED**: I could not read the paper.
- Don't confuse it with "Demircan's model" in Camposeo (2025): R = 1.05 M^0.94 (M<1.66), 1.37 M^0.54 (M>1.66). That paper cites Demircan 1989, Commun. Fac. Sci. Univ. Ankara 38, not the 1991 Ap&SS paper.

**Other two-piece empirical primaries** (VERIFIED as quoted in Camposeo 2025):
- Kopal (1959): R = M^0.98 (M<2), 1.25 M^0.64 (M>2).
- Lacy (1977, ApJS 34): 0.95 M^0.92 (M<1.3), 1.03 M^0.64 (M>1.3).
- Zamorano & Giménez (1985, Ap&SS 114, doi:10.1007/BF00653969): (1.13±0.02) M^(0.98±0.03) (M<1.8), (1.42±0.10) M^(0.56±0.04) (M>1.8).

**Newer:**
- Eker et al. 2018 (above): quadratic R = 0.438 M² + 0.479 M + 0.075 for 0.179 ≤ M ≤ 1.5 M☉. Above 1.5 M☉, use their mass–Teff relation log Teff = −0.170 (log M)² + 0.888 log M + 3.671 together with the MLR and Stefan–Boltzmann. VERIFIED.
- Camposeo, S. (2025). "A new deepening of mass-radius empirical relation for main sequence stars." *Emergent Scientist* 9, 2. doi:10.1051/emsci/2025001. A DEBCat-based two-piece refit; Zamorano's model fits best among the older ones. VERIFIED.
- Tout et al. 1996 (ZAMS R).

**Verdict:** The sheet's 0.8/0.57 is textbook folklore. The 1 M☉ break and the 0.8 low-mass exponent are not supported by the eclipsing-binary fits, which give a break at ~1.3–1.8 M☉ and an exponent of ~0.9–1.0 below it.

## 3. Main-sequence lifetime t = 10 Gyr × M/L

**Source (PARTIAL):** Hansen, C. J. & Kawaler, S. D. (1994). *Stellar Interiors: Physical Principles, Structure, and Evolution*. Springer, p. 28. This is the form τ_MS ≈ 10^10 yr (M/M☉)(L☉/L) cited in Wikipedia "Main sequence". The page is not checked.
- The scaling is textbook physics: fuel ∝ M, burn rate ∝ L.
- The 10 Gyr normalization is the solar MS lifetime.

**Match:** Yes.

**Caveat:** The approximation ignores the variable fraction of mass burned (convective cores, fully convective M dwarfs) and the change of L during the MS. Wikipedia notes that massive stars live shorter than M/L predicts.

**Newer (bibliographic VERIFIED, formula content not re-checked):** Hurley, J. R., Pols, O. R. & Tout, C. A. (2000). "Comprehensive analytic formulae for stellar evolution as a function of mass and metallicity." *MNRAS* 315, 543–569. arXiv:astro-ph/0001295.
- Gives analytic t_MS(M,Z) (via t_BGB) for 0.1–100 M☉.
- Alternatively, interpolate MIST/PARSEC isochrone grids (Choi et al. 2016, ApJ 823, 102), **UNVERIFIED** in this session.

## 4. Effective temperature T = 5776 K × (L/R²)^0.25

**Source:** This is the Stefan–Boltzmann law L = 4πR²σT⁴ scaled to the Sun.

**Constant (VERIFIED):** The IAU 2015 Resolution B3 nominal solar effective temperature is **5772 K**. Source: Prša, A. et al. (2016). "Nominal values for selected solar and planetary quantities: IAU 2015 Resolution B3." *AJ* 152, 41. doi:10.3847/0004-6256/152/2/41, arXiv:1605.09788. Resolution text: https://www.iau.org/common/Uploaded%20files/IAUGA2015-Resolution-B3-recommended-nominal-conversion.pdf
- The nominal value is an exact conversion constant.
- The best estimate is 5772.0 ± 0.8 K.
- B3 also gives nominal L☉ = 3.828×10²⁶ W and R☉ = 6.957×10⁸ m.

**Match:** No. 5776 K is an older solar value; 5777 K (Allen's Astrophysical Quantities) is the more common older figure, and the origin of 5776 specifically was not traced. The effect is 0.07%, but for traceability, use 5772 K together with the B3 nominal L☉ and R☉.

## 5. Habitable zone: inner √(L/1.1), outer √(L/0.53) AU

**Source (VERIFIED):** Kasting, J. F., Whitmire, D. P. & Reynolds, R. T. (1993). "Habitable zones around main sequence stars." *Icarus* 101, 108–128. doi:10.1006/icar.1993.1010.

**The common labelling of these limits is wrong.** √(1/1.1) = 0.953 AU and √(1/0.53) = 1.374 AU. These are Kasting et al.'s **conservative** solar limits from the abstract: 0.95 AU and 1.37 AU.
- 0.95 AU is the **water-loss (moist greenhouse)** limit.
- 1.37 AU is the **first CO₂ condensation** limit.

They are **not** the runaway-greenhouse and maximum-greenhouse limits. Per Kopparapu et al. 2013 Table 1, Kasting 1993 has:
- runaway greenhouse at 0.84 AU (S_eff ≈ 1.42);
- maximum greenhouse at 1.67 AU (S_eff ≈ 0.36).

So the numbers match Kasting 1993, but any "runaway / maximum greenhouse" label in the tool would be wrong. Kasting et al. did model how the HZ depends on spectral type (F to M stars). The sheet's √L form drops that and applies solar-spectrum fluxes to every star.

**Newer (VERIFIED):**

(a) Kopparapu, R. K. et al. (2013). "Habitable zones around main-sequence stars: new estimates." *ApJ* 765, 131. doi:10.1088/0004-637X/765/2/131, arXiv:1301.6674.
- Erratum: *ApJ* 770, 82 (2013), doi:10.1088/0004-637X/770/1/82.
- Formula: S_eff = S_eff☉ + aT⋆ + bT⋆² + cT⋆³ + dT⋆⁴, with T⋆ = Teff − 5780 K.
- Validity: 2600 ≤ Teff ≤ 7200 K.
- Distance: d = (L/L☉ / S_eff)^0.5 AU.
- The Table 3 values in arXiv v2 (Feb 2013) **predate the erratum**:

| | Recent Venus | Runaway GH | Moist GH | Max GH | Early Mars |
|---|---|---|---|---|---|
| S_eff☉ | 1.7753 | 1.0512 | 1.0140 | 0.3438 | 0.3179 |
| a | 1.4316e-4 | 1.3242e-4 | 8.1774e-5 | 5.8942e-5 | 5.4513e-5 |
| b | 2.9875e-9 | 1.5418e-8 | 1.7063e-9 | 1.6558e-9 | 1.5313e-9 |
| c | −7.5702e-12 | −7.9895e-12 | −4.3241e-12 | −3.0045e-12 | −2.7786e-12 |
| d | −1.1635e-15 | −1.8328e-15 | −6.6462e-16 | −5.2983e-16 | −4.8997e-16 |

  Which coefficients the erratum changed is **UNVERIFIED**; I could not read the erratum. Don't use this table as canonical.

(b) **Recommended canonical set:** Kopparapu, R. K. et al. (2014). "Habitable zones around main-sequence stars: dependence on planetary mass." *ApJL* 787, L29. doi:10.1088/2041-8205/787/2/L29, arXiv:1404.5292.
- Coefficients are taken verbatim from the authors' official file https://personal.ems.psu.edu/~ruk15/planets/HZ_coefficients.dat (also in HZs.f90 and the Python port hzcalc.py on the same page).
- Same polynomial and T⋆ = Teff − 5780.
- Planet masses 0.1–5 M⊕; Teff 2600–7200 K.
- The 2014 paper drops the moist-greenhouse case in favour of the runaway greenhouse.

| | Recent Venus | Runaway GH (1 M⊕) | Max GH | Early Mars | Runaway GH 5 M⊕ | Runaway GH 0.1 M⊕ |
|---|---|---|---|---|---|---|
| S_eff☉ | 1.776 | 1.107 | 0.356 | 0.320 | 1.188 | 0.99 |
| a | 2.136e-4 | 1.332e-4 | 6.171e-5 | 5.547e-5 | 1.433e-4 | 1.209e-4 |
| b | 2.533e-8 | 1.580e-8 | 1.698e-9 | 1.526e-9 | 1.707e-8 | 1.404e-8 |
| c | −1.332e-11 | −8.308e-12 | −3.198e-12 | −2.874e-12 | −8.968e-12 | −7.418e-12 |
| d | −3.097e-15 | −1.931e-15 | −5.575e-16 | −5.011e-16 | −2.084e-15 | −1.713e-15 |

Conservative HZ = runaway GH to maximum GH. Optimistic HZ = recent Venus to early Mars.

## 6. Rocky planet mass–radius with core mass fraction (CMF)

**Source (VERIFIED, full text read):** Zeng, L., Sasselov, D. D. & Jacobsen, S. B. (2016). "Mass–radius relation for rocky planets based on PREM." *ApJ* 819, 127. doi:10.3847/0004-637X/819/2/127, arXiv:1512.08827.
- Eq. (2): R/R⊕ = (1.07 − 0.21·CMF)(M/M⊕)^(1/3.7).
- Stated validity: **1 ≤ M/M⊕ ≤ 8 and 0 ≤ CMF ≤ 0.4**.
- Accuracy: within 0.01 R⊕ of their model curves.

**Match:** The coefficients match.
- The derived density ρ = 5.51·M^0.189/(1.07 − 0.21·CMF)³ is algebraically correct: 1 − 3/3.7 = 0.189, and Earth's mean density is 5.51–5.513 g cm⁻³.
- The sheet uses the fit down to **0.6 M⊕, below Zeng's 1 M⊕ lower bound**. That is an extrapolation.
- The fit is also used for CMF > 0.4 if the user allows it; that is outside the stated range.

**Low-mass branch ρ = 3.5 + 4.37·CMF g cm⁻³ (AD HOC):** No literature source found. Its structure is readable:
- At CMF = 0 it gives 3.5 g cm⁻³, roughly the zero-pressure density of silicate rock (the Moon is 3.34).
- At CMF = 1 it gives 7.87 g cm⁻³, the density of iron metal.
- So it is a zero-pressure linear mixing rule between rock and iron. It ignores self-compression, which is reasonable for small bodies. It also mixes densities linearly in mass fraction, which is not strictly correct: the correct form is 1/ρ = CMF/ρ_Fe + (1−CMF)/ρ_rock.
- There is a density discontinuity at the 0.6 M⊕ switch.

**Earth CMF 33.4% (no exact source):**
- Inverting Zeng's own fit at M = R = 1 gives (1.07 − 1)/0.21 = 0.333 (Zeng's text: "CMF⊕ = 0.07/0.21 = 0.33").
- Zeng's Table 1 lists Earth CMF = 0.325 ± 0.001.
- 33.4% is most likely a rounding artifact of 0.333. No literature source gives exactly 0.334.
- For a physical Earth value, cite 0.325 (Zeng 2016 Table 1, based on PREM) or ~0.32–0.33 from Earth's core mass (~1.94×10²⁴ kg).

**Newer/better (bibliographic from memory; UNVERIFIED this session):**
- Seager, S., Kuchner, M., Hier-Majumder, C. A. & Militzer, B. (2007). *ApJ* 669, 1279. Scaled-polytrope M–R relations valid down to small masses, which is useful for <1 M⊕.
- Zeng, L. et al. (2019). *PNAS* 116, 9723. Updated M–R tables at https://lweb.cfa.harvard.edu/~lzeng/planetmodels.html
- Otegi, J. F., Bouchy, F. & Helled, R. (2020). *A&A* 634, A43. Empirical rocky branch.
- Plotnykov, M. & Valencia, D. (2020). *MNRAS* 499, 932. CMF inversion.

## 7. Surface temperature: T_eff → gray greenhouse → /0.9

**Equilibrium step:** T_eq = [(1−A)L/(16πσd²)]^(1/4). This is the standard rapidly-rotating, full-redistribution planetary equilibrium temperature found in any planetary-science text (e.g. de Pater & Lissauer, *Planetary Sciences*, 2nd ed., CUP 2015). Correct.

**(1 + 3τ/4) factor (PARTIAL):** The physics is standard. The (2 + Dτ) structure appears in Robinson & Catling 2012 §2, but my text extraction of that equation was garbled, so no specific equation number is claimed.
- Classical gray two-stream radiative equilibrium over a black surface gives σT_s⁴ = (F/2)(2 + Dτ), i.e. T_s⁴ = T_e⁴(1 + Dτ/2), with no internal heat (F_i = 0).
- With diffusivity factor **D = 3/2** (the Eddington-type choice used by Weaver & Ramanathan 1995) this becomes **T_s⁴ = T_e⁴(1 + 3τ/4)**.
- Robinson & Catling note that D = 1.66 matches numerical results better, and D = 2 is the hemi-isotropic choice. A tool could expose D as a parameter.
- This is the planetary analogue of the Eddington stellar result T⁴(τ) = ¾T_eff⁴(τ + 2/3). The surface sits above the air temperature at the bottom of the atmosphere (the radiative-equilibrium discontinuity).

Citations:
- Robinson, T. D. & Catling, D. C. (2012). "An analytic radiative-convective model for planetary atmospheres." *ApJ* 757, 104. arXiv:1209.1833.
- Weaver, C. P. & Ramanathan, V. (1995). "Deductions from a simple climate model: factors governing surface temperature and atmospheric thermal structure." *J. Geophys. Res.* 100, 11585.
- Goody, R. M. & Yung, Y. L. (1989). *Atmospheric Radiation: Theoretical Basis*, 2nd ed., Oxford UP, pp. 391–396 (classical gray RE, as cited by Robinson & Catling).
- Pierrehumbert, R. T. (2010). *Principles of Planetary Climate*, CUP, ch. 4. Note that Pierrehumbert absorbs D into τ.

**τ = 0.5841 × greenhouse factor, and the /0.9 (AD HOC):** No source found. A web search for "0.5841" returned nothing relevant. Numeric check, my calculation: for Earth (A = 0.30, L = 1, d = 1 AU, factor = 1), T_eq = 254.6 K and the sheet chain gives T_s ≈ 286 K (285.6 K with A = 0.306).
- So the two constants together are a **calibration to Earth's ~288 K**.
- Without the /0.9, matching 288 K would need τ ≈ 0.85.
- Dividing T⁴ by 0.9 is equivalent to giving the surface a broadband IR emissivity of ε = 0.9 (εσT_s⁴ = absorbed flux). Real surface emissivities are ~0.95–0.98; this value is **UNVERIFIED** this session.
- A gray τ ≈ 0.6 is not a physical Earth infrared optical depth.
- Recommendation: present τ (or D·τ) as a free "greenhouse" parameter calibrated to Earth, and say that it is a calibration.

## 8. Gas retention (thermal/Jeans escape rule of thumb)

**Sheet:** retains a gas if v_rms = √(3RT/M) < v_esc/6, at an exospheric T = 1500 K × (T_planet/T_Earth).

**Physical basis:** Jeans escape.
- Jeans, J. H. (1925). *The Dynamical Theory of Gases*, 4th ed., Cambridge UP.
- Chamberlain, J. W. (1963). "Planetary coronae and atmospheric evaporation." *Planet. Space Sci.* 11, 901.
- Chamberlain, J. W. & Hunten, D. M. (1987). *Theory of Planetary Atmospheres*, 2nd ed., Academic Press.
- The escape flux ∝ (1+λ)e^(−λ), with Jeans parameter λ = v_esc²/v₀² and v₀ = √(2kT/m) the most-probable speed.
- The bibliographic data above are from memory (**UNVERIFIED** this session); the physics is standard.

**"v_esc > 6 v" rule:** This is a **textbook rule of thumb, not a derived criterion**.
- Introductory texts state it for the *average* speed (e.g. Freedman & Kaufmann, *Universe*, Box 7-2). The Box 7-2 attribution is from a search snippet; the page itself failed to load.
- Other teaching sources use the *rms* speed (Glasgow SSP handout) or thresholds of 1/10 or 15–20% (Lehman College problem sets).
- One arXiv review says Jeans escape is significant if v_esc ≲ 6× the mean molecular speed.

Which speed is used matters:
- 6 × v_rms means λ = 36 × 1.5 = **54**.
- 6 × mean speed means λ ≈ 36 × 1.273 = **46**.

Over 4.5 Gyr the boundary is a function of planet radius and gravity, not a fixed λ, so the tool should compute an escape timescale from the Jeans flux instead of a hard cutoff. The rule also ignores hydrodynamic, non-thermal and impact escape.
- Better general framing: Zahnle, K. J. & Catling, D. C. (2017). "The cosmic shoreline: the evidence that escape determines which planets have atmospheres." *ApJ* 843, 122 (UNVERIFIED this session).

**Exospheric temperature 1500 K:** Higher than typical.
- Global-mean Earth exospheric temperature runs ~740 K (solar minimum) to ~1260 K (solar maximum). Source: Bougher, S. W. & Roble, R. G. (1991). "Comparative terrestrial planet thermospheres 1. Solar cycle variation of global mean temperatures." *JGR* 96(A7), 11045. The numbers come from a search abstract; authors and volume are from memory (PARTIAL).
- NRLMSISE-00 profiles show ~800 K swings over the cycle. Source: Picone, J. M. et al. (2002), *JGR* 107(A12), 1468 (UNVERIFIED this session).
- 1500 K is a high-activity daytime value, not a mean.
- Scaling exospheric T linearly with surface temperature has **no physical basis** (AD HOC). Exospheric temperature is set by EUV heating and thermospheric cooling (CO₂, NO), not by the surface.

## 9. Atmospheric circulation cell count vs rotation period

**Sheet:** 1 cell if the day is ≥ 48 h; 3 cells for 6–48 h; 7 cells for 3–6 h; 5 cells for < 3 h.

**Verdict: AD HOC.** No literature source found. The going from 7 cells back to 5 at the fastest rotation is not supported by any study I found.

**What the literature says (VERIFIED):** Kaspi, Y. & Showman, A. P. (2015). "Atmospheric dynamics of terrestrial exoplanets over a wide range of orbital and atmospheric parameters." *ApJ* 804, 60. arXiv:1407.6349. Idealized moist GCM, rotation 1/16 (or 1/24) to 8 (or 12) Ω_Earth.
- At slow rotation the Hadley cells are nearly global. Only at the slowest rates (~1/16 Ω_E, ≈16 d) is the cell fully global; Titan (16 d) is the cited analogue.
- Ferrel cells, with negative mean extratropical heat transport, exist for rotation faster than ~1/4 Ω_E (≈4 d).
- The Hadley cell width shrinks with Ω, roughly following the axisymmetric Ω⁻¹ prediction of Held & Hou (1980), modified by eddies.
- "The number of jets grows with rotation rate." The change is continuous; there is no fixed cell count.
- So a single cell needs a rotation period of order **many days to weeks**, not 48 h.

Classic references (bibliographic from memory; content not re-checked):
- Held, I. M. & Hou, A. Y. (1980). *J. Atmos. Sci.* 37, 515.
- Williams, G. P. & Holloway, J. L. (1982). *Nature* 297, 295.
- Del Genio, A. D. & Suozzo, R. J. (1987). *J. Atmos. Sci.* 44, 973.
- Navarra, A. & Boccaletti, G. (2002). *Climate Dynamics* 19, 467.
- Showman, A. P., Wordsworth, R. D., Merlis, T. M. & Kaspi, Y. (2013). "Atmospheric circulation of terrestrial exoplanets." In *Comparative Climatology of Terrestrial Planets*, Univ. Arizona Press.

Recommendation: model the Hadley-cell edge latitude as a continuous function of Ω (Held–Hou scaling, capped at 90°), and the number of eddy-driven jets as increasing with Ω. Don't use a step table.

## 10. Roche limit, planetary-system inner limit, Hill sphere

**Fluid Roche limit d = 2.44 R_p (ρ_p/ρ_m)^(1/3):** Roche, É. (1849). "La figure d'une masse fluide soumise à l'attraction d'un point éloigné." *Mém. Section des Sciences, Acad. Sci. Montpellier* 1, 243–262 (2.44 on p. 258).
- PARTIAL: citation and page as given by Wikipedia "Roche limit".
- The rigid-body limit 1.26 R_p(ρ_p/ρ_m)^(1/3) is in Shu (1982), *The Physical Universe*, p. 431, as cited there.
- The sheet matches Roche's classical coefficient.

**2.455 coefficient (UNVERIFIED attribution):** I found no primary source stating 2.455 or 2.4554 during this session.
- Only a Wikipedia talk-page comment says the factor rises from 2.423 to 2.455 with synchronous rotation.
- Wikipedia's main article gives 2.423 for a version corrected for the primary's oblateness and the satellite's mass.
- The usual attribution is to Chandrasekhar's treatment of Roche ellipsoids: Chandrasekhar, S. (1963). "The equilibrium and the stability of the Roche ellipsoids." *ApJ* 138, 1182, doi:10.1086/147716; and Chandrasekhar (1969), *Ellipsoidal Figures of Equilibrium*, Yale UP, ch. 8. Check against those before citing.
- Related: Kopal & Song (1983), "Roche limit for homogeneous incompressible masses", *Ap&SS* 96 (doi:10.1007/BF00651683).
- The 2.44 vs 2.455 difference is 0.6%. Pick one, cite it, and use it the same way in both places. The sheet currently uses 2.44 for moons and 2.455 for the star.

**Planetary-system inner limit 2.455 R⋆(ρ⋆/ρ_rock)^(1/3) (AD HOC application):** This is the fluid Roche limit of a rocky body around the star. It is a defensible lower bound for where a planet could survive, but it is not a "system inner edge" from formation theory.
- Formation-based inner edges are set by dust sublimation or the magnetospheric truncation radius. Example (UNVERIFIED this session): Mulders, G. D. et al. (2015), *ApJ* 798, 112.

**Hill sphere r_H = a(m/3M)^(1/3):**
- Origin: Hill, G. W. (1878). "Researches in the lunar theory." *Am. J. Math.* 1, 5–26, 129–147, 245–260.
- Textbook: Murray, C. D. & Dermott, S. F. (1999). *Solar System Dynamics*, CUP, §3.13.
- Eccentric form a(1−e)(m/3M)^(1/3): Hamilton, D. P. & Burns, J. A. (1992). *Icarus* 96, 43–64, doi:10.1016/0019-1035(92)90005-R (as cited by Wikipedia).
- de Pater & Lissauer (2015), *Planetary Sciences*, 2nd ed., pp. 26–34.
- Stable-moon limit: Domingos, R. C., Winter, O. C. & Yokoyama, T. (2006). "Stable satellites around extrasolar giant planets." *MNRAS* 373, 1227. It gives a_crit ≈ 0.4895 R_H(1 − 1.0305e_p − 0.2738e_s) for prograde moons and ≈ 0.9309 R_H(…) for retrograde. Coefficients from memory: **UNVERIFIED**.
- Hill and Murray & Dermott bibliographic data are from memory (standard). Section numbers are UNVERIFIED.
- Match: yes, the circular-orbit form.

## 11. Tidal locking time

**Formula (PARTIAL):** t_lock ≈ ω a⁶ I Q / (3 G m_p² k₂ R⁵).
- Source: Gladman, B., Quinn, D. D., Nicholson, P. & Rand, R. (1996). "Synchronous locking of tidally evolving satellites." *Icarus* 122, 166–192, pp. 169–170. doi:10.1006/icar.1996.0117. ADS: https://ui.adsabs.harvard.edu/abs/1996Icar..122..166G
- Gladman et al. attribute it to Peale, S. J. (1977). "Rotation histories of the natural satellites." In J. A. Burns (ed.), *Planetary Satellites*, Univ. Arizona Press, pp. 87–112.
- Citation chain via Wikipedia "Tidal locking"; not checked in the paper itself.
- Background: Goldreich, P. & Soter, S. (1966). "Q in the Solar System." *Icarus* 5, 375–389 (bibliographic from memory).

**k₂ = 1.5 / (1 + 19μ/(2ρgR)):** The Love number of a homogeneous, incompressible elastic sphere.
- Love, A. E. H. (1911). *Some Problems of Geodynamics*.
- Murray & Dermott 1999, ch. 4.
- Gladman et al. 1996 use it.
- Matches the sheet. From memory: textbook formula, exact equation numbers UNVERIFIED.

**μ = 3×10¹⁰ N m⁻²:** Wikipedia's rough value for rocky bodies (4×10⁹ for icy), consistent with Gladman et al. Matches.

**Q values:** Q, k₂, ρ and R must belong to the body being despun; m_p is the mass of the body raising the tides. The sheet values are slightly off the literature:
- **Earth Q = 13 → literature Q = 12 ± 2** (semidiurnal, from lunar laser ranging). Source: Williams, J. G., Sinclair, W. S. & Yoder, C. F. (1978). "Tidal acceleration of the Moon." *GRL* 5, 943–946. VERIFIED via the NTRS abstract.
- Earth's present Q is lowered by ocean dissipation; Wikipedia suggests Q ≈ 100 for rough estimates.
- **Moon Q = 40 → literature monthly Q ≈ 33–37.**
  - Williams, J. G., Boggs, D. H., Yoder, C. F., Ratcliff, J. T. & Dickey, J. O. (2001). "Lunar rotational dissipation in solid body and molten core." *JGR* 106(E11), 27933: monthly Q = 37 (+6/−4), annual Q ≈ 60.
  - Williams et al. (2005), 14th Int. Laser Ranging Workshop, arXiv:gr-qc/0411095: monthly Q 33 ± 4, rising to ~38 at one year.
  - Values via search snippets: PARTIAL.

## 12. Frost (snow) line = 4.85 √L AU

**Hayashi:** Hayashi, C. (1981). "Structure of the solar nebula, growth and decay of magnetic fields and effects of magnetic and turbulent viscosities on the nebula." *Prog. Theor. Phys. Suppl.* 70, 35–53. doi:10.1143/PTPS.70.35.
- Optically thin nebula: T = 280 K (r/1 AU)^(−1/2)(L/L☉)^(1/4).
- Ice condenses at T = 170 K, at **2.7 AU** for the Sun, i.e. r_snow = 2.7 √L AU.
- PARTIAL: 280 K, 170 K and 2.7 AU confirmed by multiple secondary sources (Wikipedia, arXiv papers); journal volume, pages and DOI from memory.

**Other estimates:**
- Podolak & Zucker (2004). *Meteorit. Planet. Sci.* 39, 1859: ~3 AU at ~150 K.
- Martin, R. G. & Livio, M. (2012). *MNRAS Lett.* 425, L6, arXiv:1207.4284: 3.1 AU.
- Sasselov & Lecar (2000), *ApJ* 528, 995 (arXiv:astro-ph/9911390); and Lecar et al. (2006), *ApJ* 640, 1115 (arXiv:astro-ph/0602217): passive or accreting dusty disks put the snow line at ~1.6–1.8 AU, or 0.7–1.5 AU depending on accretion heating.
- Ida, S. & Lin, D. N. C. (2004), *ApJ* 604, 388, use a_ice = 2.7(M⋆/M☉)² AU, using L ∝ M⁴ for main-sequence stars (UNVERIFIED this session).

**4.85 (AD HOC / game-design origin):** No peer-reviewed source found. With Hayashi's T(r), r = (280/T)²√L, so 4.85 corresponds to a condensation temperature of **≈127 K**, colder than any standard water-ice sublimation value (145–170 K).
- The same 4.85 × √L appears in worldbuilding and RPG material: a WorldAnvil notes page attributing it to Artifexian, a Paizo forum, and Freelance Traveller's "Referees' Guide to System Building" (2025, "about 4.85×Earth-equivalent distance", no source cited).
- A forum thread quotes GURPS Traveller: *First In* as using 5√L.
- Likely origin: **GURPS Space 4e** (Steve Jackson Games, 2006) snow-line rule 4.85√L_min with L_min the initial luminosity. This could not be verified (UNVERIFIED lead).
- Recommendation: replace with 2.7√L (Hayashi) or expose the condensation temperature T_ice and compute r = (T₀/T_ice)²√L. Note that the snow line moves with disk evolution and is not a property of the present-day star.

## 13. Titius–Bode style spacing a_n = a₁ + s·2ⁿ

**Origin:** J. D. Titius (1766), an interpolation in his German translation of C. Bonnet's *Contemplation de la Nature*; popularized by J. E. Bode (1772), *Anleitung zur Kenntniss des gestirnten Himmels*, 2nd ed.
- Standard history: Nieto, M. M. (1972). *The Titius–Bode Law of Planetary Distances: Its History and Theory*. Pergamon.
- Bibliographic data from memory (UNVERIFIED this session; widely cited).

**Modern critique (VERIFIED):**
- Hayes, W. & Tremaine, S. (1998). "Fitting selected random planetary systems to Titius–Bode laws." *Icarus* 135, 549–557. doi:10.1006/icar.1998.5999, arXiv:astro-ph/9710116. Random systems with a simple stability or radius-exclusion rule fit Titius–Bode laws about as well as the Solar System. The "law" mostly reflects that stable systems are roughly geometrically spaced.
- Lynch, P. (2003). "On the significance of the Titius–Bode law for the distribution of the planets." *MNRAS* 341, 1174. Concludes that significance cannot be established unequivocally. Volume and page are from secondary sources.

**Exoplanet tests (from memory, UNVERIFIED this session):**
- Bovaird, T. & Lineweaver, C. H. (2013). *MNRAS* 435, 1126. Predictions.
- Huang, C. X. & Bakos, G. Á. (2014). *MNRAS* 442, 674. Follow-up mostly failed to find the predicted planets.

**Better basis for a generator:**
- Spacing in mutual Hill radii: Chambers, J. E., Wetherill, G. W. & Boss, A. P. (1996). *Icarus* 119, 261.
- Pu, B. & Wu, Y. (2015). *ApJ* 807, 44. Typical ~10–12 R_H,mutual.
- Observed period-ratio distributions: Fabrycky, D. C. et al. (2014). *ApJ* 790, 146.
- "Peas in a pod" regularity: Weiss, L. M. et al. (2018). *AJ* 155, 48.
- All from memory, UNVERIFIED this session.

Verdict: the sheet's relation is empirical; cite it as "Titius–Bode-type geometric spacing (empirical; see Hayes & Tremaine 1998)".

## 14. Kepler's third law P[yr] = √(a³/M); synodic period

**Textbook:**
- Murray, C. D. & Dermott, S. F. (1999). *Solar System Dynamics*, CUP, ch. 2 (two-body problem).
- Carroll, B. W. & Ostlie, D. A. (2007). *An Introduction to Modern Astrophysics*, 2nd ed., Pearson, ch. 2.

Exact form: P² = 4π²a³/[G(M⋆ + m_p)]. In units of yr, AU and M☉ that is P = √(a³/(M⋆ + m_p)). The sheet drops m_p, which is fine for planets but not for binary stars or a massive moon.

Synodic period 1/S = |1/P₁ − 1/P₂|: standard (e.g. Carroll & Ostlie ch. 1; de Pater & Lissauer). Match: yes.

## 15. Spectral class from Teff boundaries

**Reference (VERIFIED):**
- Pecaut, M. J. & Mamajek, E. E. (2013). "Intrinsic colors, temperatures, and bolometric corrections of pre-main-sequence stars." *ApJS* 208, 9. ADS 2013ApJS..208....9P.
- Main-sequence table (version 2022.04.16): https://www.pas.rochester.edu/~emamajek/EEM_dwarf_UBVIJHK_colors_Teff.txt. The file asks users to cite Pecaut & Mamajek 2013, plus Pecaut, Mamajek & Bubar 2012, *ApJ* 756, 154.
- Selected Teff from the table: O3V 44900, O5V 41400, O9V 33300, O9.5V 31900, B0V 31400, B5V 15700, B9.5V 10400, A0V 9700, A5V 8100, A9V 7400, F0V 7220, F5V 6550, F9.5V 5990, G0V 5930, G5V 5660, G9V 5380, K0V 5270, K5V 4440, K9V 3930, M0V 3850, M5V 3060, M9.5V 2350, L0V 2270 K.

| Boundary | Sheet (K) | Pecaut & Mamajek, midpoint between adjacent types (K) | Mismatch |
|---|---|---|---|
| L/M (lower end of M) | 2000 | ~2300 (M9.5V 2350 / L0V 2270) | sheet extends M ~300 K too cool |
| M/K | 3700 | ~3890 (M0V 3850 / K9V 3930) | **−190 K** |
| K/G | 5200 | ~5325 (K0V 5270 / G9V 5380) | **−125 K** |
| G/F | 6000 | ~5960 (G0V 5930 / F9.5V 5990) | ~+40 K (ok) |
| F/A | 7500 | ~7310 (F0V 7220 / A9V 7400) | **+190 K** |
| A/B | 10000 | ~10050 (A0V 9700 / B9.5V 10400) | ok |
| B/O | 33000 | ~31650 (B0V 31400 / O9.5V 31900) | **+1350 K** |

- The sheet's boundaries match the older textbook/Wikipedia Harvard table: O ≥ 30–33 kK, B 10–30/33 kK, A 7.5–10 kK, F 6–7.5 kK, G 5.2–6 kK, K 3.7–5.2 kK, M 2.4–3.7 kK.
- Current Wikipedia "Stellar classification" has been updated to O ≥ 33000, B 10000–33000, A 7300–10000, F 6000–7300, G 5300–6000, K 3900–5300, M 2300–3900. Its citations were not resolved (truncated page; likely Habets & Heintze 1981 and Weidner & Vink 2010, UNVERIFIED).
- **Linear subclass interpolation is not supported:** subclasses are not evenly spaced in Teff. For example, B0V→B5V spans 15700 K while A0V→A5V spans 1600 K. Use the Pecaut & Mamajek table and interpolate between tabulated subtypes.

---

## License / terms of use of The WorldSmith

Searched artifexian.com, the Patreon landing page, Bluesky, X, and the web generally. **No license, terms-of-use, Creative Commons, or credit/attribution statement was found.**
- **artifexian.com:** Squarespace site, no mention of WorldSmith or any license (footer only "Made with Squarespace").
- **Bluesky post, 2025-02-28** (https://bsky.app/profile/artifexian.bsky.social/post/3ljbe722hdk26): "New, new update to the WorldSmith (v.7.00)…", linking a Google Sheets `/copy` URL (https://docs.google.com/spreadsheets/d/1AML0mIQcWDrrEHj-InXoYsV_QlhlFVuUalE3o-TwQco/copy). No terms stated.
- **X/Twitter:** https://x.com/Artifexian/status/1560630063061946368 ("Worldsmith is back up and running now…"). Only seen as a search snippet; no terms seen.
- **Patreon** (https://www.patreon.com/artifexian): no mention of WorldSmith terms; only Patreon's generic Terms of Use footer.
- **YouTube descriptions** (e.g. https://www.youtube.com/watch?v=N40f1Sn4bDU) link the sheet. **The description text could not be fetched** (page rendered without it), so it is unknown whether a license line appears there.
- A third-party upload of v5.00 exists on Scribd (https://www.scribd.com/document/734446241/Copy-of-The-WorldSmith-5-00). Not official.

**Implication:** With no stated license, default copyright applies to the spreadsheet as a work. To be certain, ask Artifexian directly. Building an independent calculator from the primary literature cited above, rather than from the sheet, avoids depending on it.
