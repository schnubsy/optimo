import { describe, expect, it } from 'vitest'
import { WRONG_CODE, initialSignIn, isCompleteCode, normalizeCode, signInReducer, type SignInEvent, type SignInState } from '../../src/auth/signinMachine'

const run = (...events: SignInEvent[]) => events.reduce<SignInState>(signInReducer, initialSignIn)

describe('sign-in step machine', () => {
  it('idle → sending → code-sent moves to the code step', () => {
    const sending = run({ type: 'send', email: 'm@x.io' })
    expect(sending).toMatchObject({ phase: 'sending', step: 'email', email: 'm@x.io' })
    const sent = signInReducer(sending, { type: 'sent' })
    expect(sent).toMatchObject({ phase: 'code-sent', step: 'code', message: 'Code sent to m@x.io.' })
  })

  it('a failed send stays on the email step with the API message', () => {
    const s = run({ type: 'send', email: 'm@x.io' }, { type: 'fail', message: 'Signups not allowed for otp' })
    expect(s).toMatchObject({ phase: 'error', step: 'email', message: 'Signups not allowed for otp' })
  })

  it('code-sent → verifying → error keeps the code step so the user can retry', () => {
    const s = run({ type: 'send', email: 'm@x.io' }, { type: 'sent' }, { type: 'verify' })
    expect(s).toMatchObject({ phase: 'verifying', step: 'code', message: '' })
    const err = signInReducer(s, { type: 'fail', message: WRONG_CODE })
    expect(err).toMatchObject({ phase: 'error', step: 'code', message: WRONG_CODE })
    expect(signInReducer(err, { type: 'verify' }).phase).toBe('verifying')
  })

  it('resend from the code step stays on the code step; a cooldown error surfaces there', () => {
    const s = run({ type: 'send', email: 'm@x.io' }, { type: 'sent' }, { type: 'send', email: 'm@x.io' })
    expect(s).toMatchObject({ phase: 'sending', step: 'code' })
    const cool = signInReducer(s, { type: 'fail', message: 'For security purposes, you can only request this after 57 seconds.' })
    expect(cool).toMatchObject({ phase: 'error', step: 'code' })
    expect(cool.message).toMatch(/57 seconds/)
  })

  it('back returns to the email step, remembering the address', () => {
    const s = run({ type: 'send', email: 'm@x.io' }, { type: 'sent' }, { type: 'back' })
    expect(s).toEqual({ ...initialSignIn, email: 'm@x.io' })
  })

  it('ignores events that do not fit the phase (no double submit, no verify before a code is sent)', () => {
    expect(run({ type: 'verify' })).toEqual(initialSignIn)
    const sending = run({ type: 'send', email: 'm@x.io' })
    expect(signInReducer(sending, { type: 'send', email: 'm@x.io' })).toBe(sending)
    expect(signInReducer(sending, { type: 'back' })).toBe(sending)
    const verifying = run({ type: 'send', email: 'm@x.io' }, { type: 'sent' }, { type: 'verify' })
    expect(signInReducer(verifying, { type: 'verify' })).toBe(verifying)
    expect(signInReducer(initialSignIn, { type: 'sent' })).toBe(initialSignIn)
    expect(signInReducer(initialSignIn, { type: 'fail', message: 'x' })).toBe(initialSignIn)
  })
})

describe('code input', () => {
  it('strips spaces and other paste noise, caps at 6 digits', () => {
    expect(normalizeCode(' 123 456 ')).toBe('123456')
    expect(normalizeCode('123-456')).toBe('123456')
    expect(normalizeCode('12345678')).toBe('123456')
    expect(normalizeCode('abc')).toBe('')
  })
  it('only exactly 6 digits is complete', () => {
    expect(isCompleteCode('123456')).toBe(true)
    expect(isCompleteCode('12345')).toBe(false)
    expect(isCompleteCode('12345a')).toBe(false)
  })
})
