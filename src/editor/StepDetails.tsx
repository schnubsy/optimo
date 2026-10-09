import type { TaskInput } from '../data/repo'
import type { SettingsData } from '../data/types'
import { Icon } from '../icons/Icon'
import { DateRow } from './StepWhen'
import { draftToInput, durLong, fmtRange, type WizardDraft } from './wizardModel'

export interface StepDetailsProps {
  draft: WizardDraft
  settings: SettingsData
  /** receives the finished task input; the wizard creates it, moves the day, closes and toasts */
  onCreate: (input: TaskInput & { start_at: string | null }) => void | Promise<void>
  /** back to ② (the time row) — absent in inbox mode */
  onEditWhen?: () => void
}

/**
 * ③ Details — the minimal slice-6 stub: the date / time summary rows and Create Task. Slice 7 grows this into the
 * full details + edit screen (mockups 06: alerts, repeat, subtasks, notes, palette) by adding fields to the input
 * it hands to `onCreate`.
 */
export function StepDetails({ draft, settings, onCreate, onEditWhen }: StepDetailsProps) {
  return (
    <div className="wiz-body wiz-step3">
      {!draft.inbox && (
        <div className="wiz-card wiz-rows">
          <DateRow date={draft.date} testid="details-date" />
          <button type="button" className="wiz-row" onClick={onEditWhen} disabled={!onEditWhen} data-testid="details-time">
            <Icon name="ui-clock" size={24} className="wiz-row-glyph" />
            <span className="wiz-row-text tnum">{draft.all_day ? 'All day' : fmtRange(draft.start, draft.duration, settings.clock24)}</span>
            <span className="wiz-row-end">
              {durLong(draft.duration)}
              {onEditWhen && <Icon name="ui-chevron-right" size={16} />}
            </span>
          </button>
        </div>
      )}
      {draft.inbox && (
        <div className="wiz-card wiz-row-card">
          <div className="wiz-row" data-testid="details-inbox">
            <Icon name="ui-inbox" size={24} className="wiz-row-glyph" />
            <span className="wiz-row-text">Inbox</span>
            <span className="wiz-row-end">{durLong(draft.duration)}</span>
          </div>
        </div>
      )}
      <div className="wiz-foot">
        <button type="button" className="wiz-cta" onClick={() => void onCreate(draftToInput(draft, settings))} data-testid="wizard-create">
          Create Task
        </button>
      </div>
    </div>
  )
}
