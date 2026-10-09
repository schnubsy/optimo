import { useEffect, useRef, type KeyboardEvent } from 'react'
import * as repo from '../data/repo'
import { DEFAULT_DURATION_PRESETS } from '../data/types'
import { Icon } from '../icons/Icon'
import { Wheel } from './TimeWheel'
import { presetChip } from './wizardModel'

/**
 * Duration sheet (mockups 03): hours · min wheels over the editor, then the editable presets — × removes, + saves the
 * wheel value, Reset restores the defaults. Presets persist in settings.duration_presets.
 */
export function DurationSheet({ value, presets, onChange, onClose }: { value: number; presets: number[]; onChange: (min: number) => void; onClose: () => void }) {
  const h = Math.min(23, Math.floor(value / 60))
  const m = value % 60
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('.wheel-scroll')?.focus()
  }, [])
  const save = (list: number[]) => repo.updateSettings({ duration_presets: list })
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      onClose()
    }
  }
  const canAdd = value > 0 && !presets.includes(value)
  return (
    <div className="dur-wrap" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className="dur-sheet" role="dialog" aria-modal="true" aria-labelledby="dur-h" onKeyDown={onKey} data-testid="duration-sheet">
        <header className="dur-hd">
          <h2 id="dur-h">Duration</h2>
          <button type="button" className="dur-x" aria-label="Close duration" onClick={onClose}>
            <Icon name="ui-close" size={20} />
          </button>
        </header>
        <div className="dur-wheels">
          <Wheel
            className="dur-wheel"
            count={24}
            index={h}
            onIndex={(i) => onChange(i * 60 + m)}
            label="Hours"
            rowLabel={String}
            rowH={30}
            idPrefix="dh"
            testid="duration-hours"
            overlay={<span className="dur-unit">hours</span>}
          />
          <Wheel
            className="dur-wheel"
            count={60}
            index={m}
            onIndex={(i) => onChange(h * 60 + i)}
            label="Minutes"
            rowLabel={String}
            rowH={30}
            idPrefix="dm"
            testid="duration-minutes"
            overlay={<span className="dur-unit">min</span>}
            page={5}
          />
          <i className="dur-band" aria-hidden="true" />
        </div>
        <div className="dur-presets-hd">
          <h3 id="dur-p">Presets</h3>
          <button type="button" className="dur-reset" onClick={() => void save([...DEFAULT_DURATION_PRESETS])} data-testid="presets-reset">
            <Icon name="ui-repeat" size={18} />
            Reset
          </button>
        </div>
        <ul className="dur-chips" aria-labelledby="dur-p" data-testid="presets">
          {presets.map((p) => (
            <li key={p} className="dur-chip" data-testid="preset" data-min={p}>
              <button type="button" className="dur-chip-use tnum" aria-pressed={p === value} onClick={() => onChange(p)}>
                {presetChip(p)}
              </button>
              <button type="button" className="dur-chip-x" aria-label={`Remove ${presetChip(p)} preset`} onClick={() => void save(presets.filter((x) => x !== p))}>
                <Icon name="ui-close" size={16} />
              </button>
            </li>
          ))}
          {canAdd && (
            <li className="dur-chip add">
              <button type="button" className="dur-chip-use tnum" aria-label={`Add ${presetChip(value)} as a preset`} onClick={() => void save([...presets, value].sort((a, b) => a - b))} data-testid="preset-add">
                <Icon name="ui-plus" size={16} />
                {presetChip(value)}
              </button>
            </li>
          )}
        </ul>
      </div>
    </div>
  )
}
