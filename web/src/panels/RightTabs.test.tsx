import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useMission } from '../app/store'
import { fixtures } from '../lib/fixtures'
import { RightTabs } from './RightTabs'

beforeEach(() => {
  useMission.getState().reset()
  const s = useMission.getState()
  s.setDemo(true)
  s.setAoi(fixtures.aoi)
  s.setConditions(fixtures.conditions)
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 404 }))
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('RightTabs', () => {
  it('shows Route first and switches tabs on click', () => {
    render(<RightTabs />)
    expect(screen.getByRole('tab', { name: 'Route' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByTestId('route-sheet')).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: 'Conditions' }))
    expect((document.getElementById('panel-conditions') as HTMLElement).hidden).toBe(false)
    expect((document.getElementById('panel-route') as HTMLElement).hidden).toBe(true)
  })

  it('opens the Stop tab when a stop is picked on the map', () => {
    render(<RightTabs />)
    act(() => useMission.getState().selectStop('s1'))
    expect(screen.getByRole('tab', { name: 'Stop' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByTestId('stop-card')).toBeTruthy()
  })
})
