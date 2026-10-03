// Settings → Planning (arc 3): default mode and research for the Plan tab, a read-only summary of what the planner
// has learned (planner_ai_profile, distilled server-side by plan-day `learn`), and Reset (tombstones the profile).
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../data/db'
import { resetAiProfile, updateSettings } from '../data/repo'
import type { AiProfileData, SettingsData } from '../data/types'
import { useUI } from '../state/ui'

/** A labelled row of pressed-state buttons inside the Planning card. */
function Choice<T extends string | boolean>({ label, name, value, options, onChange }: { label: string; name: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  const id = `set-${name}-label`
  return (
    <div className="plan-choice" role="group" aria-labelledby={id} data-testid={`set-${name}`}>
      <span id={id} className="sub">
        {label}
      </span>
      <div className="set-actions seg-in">
        {options.map(([v, l]) => (
          <button key={String(v)} type="button" aria-pressed={value === v} onClick={() => onChange(v)}>
            {l}
          </button>
        ))}
      </div>
    </div>
  )
}

/** The profile in plain words; empty fields are left out. */
export function learnedLines(d: AiProfileData): string[] {
  const out: string[] = []
  if (d.day_shape) out.push(`Day shape: ${d.day_shape}`)
  if (d.preferred_block_min) out.push(`Focus blocks: about ${d.preferred_block_min} min`)
  if (d.buffers) out.push(`Buffers: ${d.buffers}`)
  if (d.tone) out.push(`Tone: ${d.tone}`)
  if (d.habits?.length) out.push(`Habits: ${d.habits.join('; ')}`)
  if (d.avoid?.length) out.push(`Avoid: ${d.avoid.join('; ')}`)
  return out
}

export function PlanningSettings({ s }: { s: SettingsData }) {
  const profile = useLiveQuery(() => db.aiProfile.filter((p) => !p.deleted_at).first(), [])
  const notify = useUI((x) => x.notify)
  const lines = profile ? learnedLines(profile.data) : []
  return (
    <fieldset className="set-row plan-set" aria-labelledby="set-planning-label" data-testid="set-planning">
      <h3 id="set-planning-label">Planning</h3>
      <Choice name="plan-mode" label="Plan tab starts in" value={s.plan_mode ?? 'propose'} options={[['propose', 'Propose — review first'], ['auto', 'Auto — write the day, with Undo']]} onChange={(v) => void updateSettings({ plan_mode: v })} />
      <Choice name="plan-research" label="Web research" value={s.plan_research ?? false} options={[[false, 'Off by default'], [true, 'On by default']]} onChange={(v) => void updateSettings({ plan_research: v })} />
      <div className="plan-learned" data-testid="set-learned">
        <span className="sub">What optimo has learned</span>
        {lines.length ? (
          <>
            <ul>
              {lines.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
            <p className="muted">
              From {profile!.accepted_count} accepted plan{profile!.accepted_count === 1 ? '' : 's'}.
            </p>
            <div className="set-actions">
              <button
                type="button"
                className="ghost-btn"
                onClick={async () => {
                  await resetAiProfile()
                  notify({ text: 'Planning style reset — the planner starts fresh.' })
                }}
                data-testid="learned-reset"
              >
                Reset
              </button>
            </div>
          </>
        ) : (
          <p className="muted">Nothing yet — accept or edit a few plans and the planner picks up your style.</p>
        )}
      </div>
    </fieldset>
  )
}
