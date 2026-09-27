## 2026-09-27 — Hotfix: accept the 6-digit sign-in code (single slice)

DECISION (2026-09-27): the shared `press` Supabase project sends a **6-digit code** in its Magic Link email
(rewritten to `{{ .Token }}` for remit's family wing — `remit/docs/spec.md` §8). That template is press-owned
and stays. optimo therefore accepts the code: `signInWithOtp` → user types the code → `verifyOtp({ email,
token, type: 'email' })`. The redirect link path is no longer the primary flow (keep `emailRedirectTo` so a
link-style template would still work). Sign-ups are OFF in that project by design; Mark's user already exists.
SINGLE-SLICE JUSTIFICATION: Mark cannot sign in to the live app until this ships, and the arc-2 order depends
on his hands-on feedback (checkpoint item 5) — a hard dependency.
RULE: optimo shares press's Auth config (email template, SMTP, sign-ups OFF, Site URL = remit's page). Never
change press Auth settings from an optimo arc; adapt optimo to them.

```
Work order — optimo hotfix: 6-digit sign-in code

Repo: /Users/mark/Documents/code/optimo   (GitHub: schnubsy/optimo)
MAIN CHECKOUT: /Users/mark/Documents/code/optimo
INBOX FILES: none
Branch: git checkout -b arc/hotfix-otp-code

STANDING RULES (verbatim in every order)
(1) Plan mode ONCE at the start. Batch every question up front, then run every slice back-to-back with
    no further pauses. Return only at arc-complete or a genuine blocker.
(2) Session branch arc/<slug>. `git add` by name only, never `-A`. Never `rm -rf` (use `rm -r`). Never
    remove or move a git worktree inside the order.
(3) PER-SLICE LOOP (every slice): extend the tests to cover the slice → build/typecheck/lint clean →
    run the gauntlet (skills/_shared/references/testing.md) → capture done-proof into
    docs/evidence/<arc>-slice-<N>-<name>.<ext> IN THE REPO → commit `feat: slice <N> — <summary>` →
    run /council:handoff → next slice, without returning.
    Per-slice `/council:handoff` is **tick + commit ONLY**: tick this slice `Status: done <sha>` in
    ARC.md and commit — nothing else. The FULL close (CLAUDE.md Current stage, docs/history.md,
    docs/lessons.md, HANDOFF.md overwrite, ARC.md truncate) does NOT run per slice; it runs ONCE at
    arc-complete, BEFORE the PR (rule 4), so it ships inside the same PR.
(4) ARC-COMPLETE CLOSE (fully automatic once gauntlet + sentry are BOTH green):
      FULL CLOSE FIRST (runs ONCE, BEFORE the PR so it ships in the same PR): the final
      `/council:handoff` — overwrite CLAUDE.md Current stage, prepend docs/history.md, promote
      docs/lessons.md, overwrite HANDOFF.md, tick every slice + truncate ARC.md — committed on the
      branch → THEN
      push branch → `gh pr create --fill --base main` → `gh pr merge --merge --delete-branch`
      → RECONCILE THE MAIN CHECKOUT (mandatory, immediately after the merge):
          git -C <MAIN CHECKOUT> checkout main && git -C <MAIN CHECKOUT> pull --ff-only
        then ASSERT `git -C <MAIN CHECKOUT> rev-parse HEAD` == the merge commit SHA. The arc is NOT
        closed until this passes. Every manual step Mark runs next — deploy, publish, build — runs
        against the MAIN CHECKOUT's working tree, not against GitHub; a merged PR over a stale main
        checkout ships the PREVIOUS arc's code and reports success. If the pull cannot fast-forward,
        STOP and report a blocker; never force it.
      → if the project is a marquee page: PUBLISH via the press instrument, **strictly AFTER the merge
        and the main-checkout reconcile — publishing before merge is a RED close** (it ships the
        pre-merge tree). Build → copy to ~/Documents/code/press/<page>.html [+ its assets dir] →
        commit → push; verify the live URL returns 200 AND `git hash-object <file>` == the GitHub blob
        SHA (this is the press case of SHIP PROOF — control-files.md)
      → SHIP PROOF for anything this arc deployed or published, per control-files.md → "Verify the
        artifact, not the act": fingerprint before AND after, assert it CHANGED and matches source.
        A deploy this arc cannot prove is a RED gate, not a footnote.
      → INBOX CLEANUP: after the merge, remove the now-duplicate uncommitted inbox copies (ARC.md +
        INBOX FILES) from the MAIN CHECKOUT **only if** each is byte-identical (`git hash-object`) to its
        merged version; if any differs, LEAVE it and report the mismatch.
      → report: commits, PR URL, live URL, evidence files, Mark's manual steps (the full close/handoff
        already ran BEFORE the PR, per the top of this rule — it is not repeated here).
      → CLOSE-OUT MANIFEST (the close is not complete until this is emitted). Enumerate EVERY
        required close step and give each EXACTLY ONE explicit outcome — never silence, never prose:
          push · PR · merge · reconcile main checkout · migrations/backfills · deploy · publish ·
          inbox cleanup · handoff
        Per step, one of:
          DONE     + its proof (sha, hash, version fingerprint, URL status) — an assertion is not proof
          N/A      + one line saying why it does not apply to this project
          BLOCKED  + it goes to HANDOFF "Mark's manual steps" as a NUMBERED item carrying its guarded
                     command (precondition && action && postcondition) and the expected postcondition value
        A step that is neither DONE, N/A nor BLOCKED is a RED close. Absence is the failure mode this
        exists to catch: on 2026-09-21 a required publish was simply missing from the report and
        nobody noticed for four hours.
    If either gate is RED: stop at the last green slice, leave the branch pushed, open the PR as DRAFT,
    and report. Nothing else returns to Mark.
(5) Publishing is PART OF THE CLOSE — the old "press publishing stays Mark's" rule is retired. Publish
    strictly AFTER merge + the main-checkout reconcile; **publishing before merge is a RED close.**
(6) Never claim "deployed" / "published" / "live" from a command's exit code, a printed success line,
    or an incremented version number. Ship proof or it did not ship.

ORIENT FIRST
INBOX SYNC (first, before reading anything): if this session is in a git worktree
(`git rev-parse --git-common-dir` ≠ `.git`), copy ARC.md from MAIN CHECKOUT into the worktree byte-identical
(verify with `git hash-object` both sides); if ARC.md is still empty afterwards, STOP and report a blocker.
Read: CLAUDE.md, HANDOFF.md, ARC.md. Skip the lessons/history sub-agent (one-slice hotfix); read only
src/auth/session.ts, src/components/SignIn.tsx, src/components/signin.css, tests/smoke.spec.ts and the
existing sign-in tests.
Project-specific: not a marquee page — press PUBLISH is N/A; deploy = GitHub Pages on merge to main with the
`<meta name="build">` ship proof.

=== SLICE 1 — code entry on the sign-in screen ===   Status: done 29a5cef
Scope: two-step sign-in: email → "Enter the 6-digit code from your email" → verifyOtp. No press Auth changes.
Files in play: src/auth/session.ts, src/components/SignIn.tsx, src/components/signin.css, tests/unit (auth
  state machine), tests/signin.spec.ts (new), tests/smoke.spec.ts (unchanged), docs/spec.md §4 auth row.
Implementation:
  - session.ts: keep sendMagicLink (rename sendSignInCode; keep emailRedirectTo). Add
    `verifySignInCode(email, code)` → `sb.auth.verifyOtp({ email, token: code, type: 'email' })`; return the error
    message or null. Trim/strip spaces from the code; 6 digits only.
  - SignIn.tsx: step 1 email + "Send code" (existing copy: "One timeline for the day." stays); on success show
    step 2: the email (editable back-link "Use a different email"), a 6-digit input (`inputmode="numeric"`,
    `autocomplete="one-time-code"`, auto-submit on 6th digit, paste-friendly), "Sign in" button, "Resend code"
    with the 60 s cooldown message the API returns, and inline error text (aria-live). Still no code field until
    a code has been sent. Wrong code → "That code didn't match. Try again or resend." Expired → same + resend.
  - If the app is opened from a link that carries a session (link-style template), the existing
    onAuthStateChange path signs in as before — keep it.
  - docs/spec.md §4 Auth row: "Supabase Auth, email one-time code (shared press template), single user".
  - Update `docs/history.md` one line via the close; HANDOFF "Mark's manual steps" → sign in with the code.
Done-criteria: unit test for the auth step machine (idle → code-sent → verifying → error/back) · signin.spec.ts
  on desktop + iPhone 15 against the fake server: send code → enter 6 digits → lands on the day view; wrong code
  shows the error; resend respects cooldown · axe clean on both steps · gauntlet GREEN · evidence: screenshots
  of both steps (dark + light, iPhone) · live URL build meta == merge SHA.

RETURN POINTS: arc-complete, or genuinely blocked. Errors are fixed, re-run, and re-validated inside the order —
nothing else returns to Mark.
```
