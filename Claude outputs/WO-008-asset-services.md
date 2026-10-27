# WO-008 — Asset services: the cheapest that do the job

Prices checked on **2026-10-22**: the recommended plans from the providers' own pages; some runners-up and rejects from third-party price trackers (see Sources). SAR = USD × 3.75 (the peg). Prices change, so re-check them before buying. Updated 2026-10-28 for the COO's directive (WO-009): the timing changed; the prices did not.

## What "does the job" means (WMD Charter §3–4)
A service qualifies only if it has all four:
1. **An API**, so artist generates from the repo with no hand-offs between apps.
2. **Terms that allow commercial use**, with the output owned by WM.
3. **The right output:** GLB with polycount control for 3D; web-ready files for audio.
4. **A price** that fits 1,000 SAR a month with room to spare.

## Recommendation

**Buy nothing now.** This replaces the 2026-10-22 WMD Log's advice to buy audio now.
- **3D:** no 3D plan until the CEO rules on hard rule 7, on page one of the style guide (WO-009 §2).
- **Audio:** the style guide's audio section comes first (tripwire T3). SPEC also puts sound in M6, so nothing can play it before then. A plan bought now pays for idle months.
- **Test clips:** a free tier is fine for test clips (WO-009 §4). ElevenLabs Free gives 8 sound-effect generations and 3 music minutes a month. None of it ships: the free plan lists no commercial licence.

### 3D: Meshy Pro — $20 a month (75 SAR)
Buy it only if the CEO's ruling allows AI models, when artist starts on them. Cancel it when the asset pass is done (T2).
- **API:** Pro is Meshy's cheapest plan with API keys. The free plan cannot create keys.
- **Licence:** paid-plan output is private and customer-owned. Free-plan output is CC BY 4.0.
- **Output:** GLB (the default), plus FBX, OBJ, USDZ, STL and .blend.
- **Polycount control:** Remesh (5 credits) takes a `target_polycount` of 100 to 300,000 faces, which per-asset budgets need.
- **Capacity:** 1,000 credits a month.
  - Untextured mesh on the low-cost model (5 credits) + remesh (5) = 10 credits ≈ $0.20 an asset, about 100 a month.
  - On the newest model, 20 + 5 = 25 credits ≈ $0.50 an asset, about 40 a month.
- **Catch:** Pro keeps assets for only 3 days. artist saves each one to the repo at once, so this doesn't matter.

### Audio: ElevenLabs Starter — $6 a month (22.5 SAR)
Buy it when the CEO has approved the style guide's audio section and a work order adds sound. One month probably covers Level 1; then cancel (T2).
- **API:** included.
- **Licence:** commercial licence on Starter and up, music included.
- **Rates:** sound effects $0.12 a minute and music $0.15 a minute. Starter includes 150 sound-effect generations and 40 music minutes a month.
- **One key** covers both sound effects and music.

### Both running
$26 a month ≈ 97.5 SAR, about 10 % of the cap. The cap is not the constraint. Licence terms, API access and the look are.

## Runners-up and rejects

**3D**

| Service | Price | Verdict |
|---|---|---|
| Tripo API (pay as you go, through fal.ai) | $0.01 a credit on fal.ai. Tripo's own page counts untextured 10 + smart low-poly 10 = 20 credits ≈ $0.20 an asset, if fal.ai bills the same counts. No subscription. | **Runner-up.** Same per-asset cost as Meshy with no idle months. Its API licence terms weren't on the pages checked; verify them before choosing it. |
| TRELLIS on fal.ai | $0.02 a generation | Cheapest raw mesh. No target-polycount remesh on the pages checked, so meeting budgets likely needs a mesh simplifier, which is a new dependency (hard rule 1). |
| Hunyuan3D v2 mini turbo on fal.ai | $0.08 untextured; 3× that textured | Licence not verified today. Tencent's community licence for Hunyuan3D has excluded some territories, which is a risk if the CEO ever sells. |
| Sloyd Plus | $15 a month | No API below its Studio/Enterprise tiers (contact sales). |
| Meshy Free | $0 | No API keys; output is CC BY 4.0. |

**Audio**

| Service | Price | Verdict |
|---|---|---|
| ElevenLabs Free | $0 | Test clips only: no commercial licence listed. 8 sound-effect generations and 3 music minutes a month. |
| ElevenLabs sound effects on fal.ai | $0.20 per 100 s (= $0.12 a minute) | Same rate with no subscription, but it adds a reseller to the licence chain. |

## Recommendation for the rule-7 ruling (the CEO's call)
Page one of the style guide sets out three options (WO-009 §2). The Dev Manager recommends the middle one, primitives plus a small set of AI models:
- **Keep primitive:** the player, the Cores, the Shard and every gameplay prop. They carry the colour language, the sockets and the procedural animation.
- **AI geometry only for static set dressing:** cliffs, rocks, ruins.
- **Untextured, with flat palette materials set in code.** That protects the colour language, and untextured generations cost less.
- **Colliders stay authored primitives**, so collision doesn't change.

## Setup the CEO does before the first API call, paid or free
1. **Allow the provider domains** for this workspace:
   - Meshy: `api.meshy.ai` and `assets.meshy.ai`;
   - ElevenLabs: `api.elevenlabs.io`.
2. **Give the keys a home that survives sessions.** Each new session starts from an empty workspace, so a git-ignored file here would not carry over.

There is no connector route today. The directory's ElevenLabs connector manages voice agents, not sound effects or music, and there is none for Meshy or Tripo.

## Sources
- Meshy plans: https://www.meshy.ai/pricing
- Meshy API credit costs: https://docs.meshy.ai/api/pricing.md
- Meshy Remesh API (target_polycount, GLB): https://docs.meshy.ai/api/remesh.md
- Meshy API keys and domains: https://docs.meshy.ai/api/quick-start.md
- ElevenLabs plans: https://www.elevenlabs.io/pricing
- ElevenLabs API rates: https://elevenlabs.io/pricing/api
- Tripo API credits per task: https://developers.tripo3d.com/en/pricing
- fal.ai prices (Tripo H3.1, ElevenLabs sound effects), captured 2026-10-01: https://pricingsaas.com/companies/fal/diffs/2026D274
- TRELLIS on fal.ai: https://cloudprice.net/models/fal-ai-trellis
- Hunyuan3D v2 mini turbo on fal.ai: https://fal.ai/models/fal-ai/hunyuan3d/v2/mini/turbo/llms.txt
- Sloyd plans: https://costbench.com/software/ai-3d-generation/sloyd/
