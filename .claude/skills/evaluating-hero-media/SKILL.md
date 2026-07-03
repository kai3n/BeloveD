---
name: evaluating-hero-media
description: Use when judging whether a photo or video is good enough for the belovediamond.com hero, category cards, product pages, reviews, or ads — e.g. "이거 히어로로 어때?", "평가해줘", "estimate score", comparing candidate assets, or before committing any new media asset to the site.
---

# Evaluating Hero & Product Media

## Overview

Score media against the fixed rubric below instead of ad-hoc impressions, and verify with extracted evidence — never judge a video from metadata or a single frame. Present every evaluation in the same category table so assets stay comparable across sessions.

## Inspection procedure (before scoring)

**Video:**
1. `ffprobe` — resolution, fps, duration, bitrate, file size, and whether an audio stream exists (heroes autoplay muted; a silent audio track is dead weight to strip).
2. Extract 8+ frames spread across the full duration (`ffmpeg -ss $t -i in.mp4 -frames:v 1 -q:v 2 out.jpg`) and **view every one**.
3. Detect cuts: `-vf "select='gt(scene,0.35)',showinfo"` — scene count drives loop strategy.
4. **Temporal consistency (any AI-generated or suspect content):** compare the SAME objects at early/mid/late timestamps — ring band metal color, stone size/shape/prong count, hands, text props. Smooth consecutive frames do NOT prove consistency; AI drift happens over seconds, not between adjacent frames.
5. Loop seam: compare first vs last frame.
6. Measure warm cast instead of eyeballing it: `ffmpeg -i in.mp4 -vf signalstats -f null -` and read mean V−U per frame (0 = neutral; sustained positive = warm/yellow, a defect under the icy-white rule).

**Images:** view at full resolution (hero needs ≥1600px wide), zoom into the stone, check background consistency against sibling images in the same grid.

## Rubric — score each category /10

| Category | What decides the score |
|---|---|
| Technical specs | Resolution/fps/weight. Hero autoplay target: 1080p+, ≤5MB after re-encode |
| Cinematography & lighting | Diffused light, soft shadows = luxury grammar. Hard direct sun, clipped highlights, visible hand shadows = UGC, score low |
| Color & brand tone | Icy-white mandate: ANY warm/yellow cast is a defect (owner's standing rule — do not excuse it because the shot is pretty). Asset must sit in BOTH NOIR dark mode and Gallery White day mode; champagne #8f7d54 accent is the only warm note allowed |
| Product presence & fidelity | The stone must be the protagonist (first thing the eye lands on) AND optically real: visible facet structure, fire, no blown-out white core, correct cut geometry. Wrong diamond optics on an IGI/GIA-certified brand = trust killer |
| Brand safety | No competitor-identifiable pieces (Tiffany T, Cartier Love, etc.) — scan every hand/wrist/neck in styled shots. No gold-heavy styling off the white-gold positioning. No identifiable faces (anonymity rule). AI tells: gibberish text props, morphing objects, waxy/leathery skin, anatomy lumps |
| Hero practicalities | Calm negative space for headline+CTA with stable contrast; seamless loop or fade-loop point; portrait mobile crop keeps the subject. For product images judge crop/margin/background consistency instead |
| Mood & target fit | Bridal / quiet-luxury resonance for the custom-engagement audience |
| Reuse value | If it fails the hero bar, where does it earn its keep? (reviews/process/story b-roll, guide pages, category card) |

## Output format

1. Category table with scores and one-line reasons.
2. Split verdict: "X/10 as hero, Y/10 as asset" — these often diverge and the split is the insight.
3. Disposition, one of: **ship** / **fix list** (the exact edits that make it shippable, e.g. trim to one scene, cool regrade, strip audio, re-encode) / **repurpose** (name the section) / **reject**.

## Common mistakes

- Scoring brand tone generously because the content is beautiful — the no-yellow rule outranks prettiness.
- Checking only consecutive frames for AI morphing, then missing slow drift (band color, stone size). Track one object across the whole clip.
- Judging against one theme only — the hero renders in dark AND day mode.
- Skipping the competitor-brand scan on lifestyle/styled shots.
- Reporting specs and mood but omitting overlay space, loop seam, and mobile crop — the checks that actually block shipping.
