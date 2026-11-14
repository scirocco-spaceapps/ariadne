import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useMission } from '../app/store'
import { DevStopsPage } from './DevStopsPage'
import { fixtureStops } from './loader'
import { StopCard, type StopCardVariant } from './StopCard'
import { useStopTasks } from './taskStore'

beforeEach(() => {
  useMission.getState().reset()
  useStopTasks.getState().reset()
})

afterEach(cleanup)

const variants: StopCardVariant[] = ['console', 'cuff']

describe.each(variants)('StopCard variant=%s', (variant) => {
  it('renders the fixture stop s1 with question, tasks, photo credit and badges', () => {
    render(<StopCard variant={variant} id="s1" />)
    const card = screen.getByTestId('stop-card')
    expect(card.dataset.variant).toBe(variant)
    expect(screen.getByRole('heading', { level: 2, name: 'SYNTHETIC stop 1' })).toBeTruthy()
    expect(screen.getByText(/what does this outcrop record/)).toBeTruthy()
    expect(screen.getAllByRole('checkbox')).toHaveLength(2)
    expect(screen.getByTestId('photo-credit').textContent).toBe('Credit: SYNTHETIC placeholder')
    expect(screen.getByText('Sol 1200 · SYNTHETIC camera')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Raw image page' }).getAttribute('href')).toBe(
      'https://example.invalid/synthetic/s1/0',
    )
    expect(within(card).getByText('SYNTHETIC')).toBeTruthy()
    expect(within(card).getByText('Draft')).toBeTruthy()
    expect(within(card).getAllByText('Simulation').length).toBeGreaterThan(0)
    expect(screen.queryByTestId('stop-seen')).toBeNull()
  })

  it('shows the "seen, never visited" line for the target t1', () => {
    render(<StopCard variant={variant} id="t1" />)
    expect(screen.getByTestId('stop-seen').textContent).toContain('Seen from 100 m on sol 1205, never visited')
    expect(screen.getByText('Target')).toBeTruthy()
  })

  it('keeps the credit line when the image fails to load', () => {
    render(<StopCard variant={variant} id="s1" />)
    fireEvent.error(screen.getByRole('img', { name: 'SYNTHETIC placeholder caption' }))
    expect(screen.getByText('Image unavailable')).toBeTruthy()
    expect(screen.getByTestId('photo-credit').textContent).toBe('Credit: SYNTHETIC placeholder')
  })
})

describe('StopCard behaviour', () => {
  it('ticks tasks in the store, not persisted', () => {
    render(<StopCard variant="console" id="s1" />)
    const [first] = screen.getAllByRole('checkbox') as HTMLInputElement[]
    fireEvent.click(first)
    expect(first.checked).toBe(true)
    expect(useStopTasks.getState().ticks).toEqual({ s1: [0] })
    expect(screen.getByText('1 / 2')).toBeTruthy()
    fireEvent.click(first)
    expect(useStopTasks.getState().ticks).toEqual({ s1: [] })
    expect(localStorage.length).toBe(0)
  })

  it('shares ticks between the two variants', () => {
    render(
      <>
        <StopCard variant="console" id="s1" />
        <StopCard variant="cuff" id="s1" />
      </>,
    )
    const boxes = screen.getAllByRole('checkbox') as HTMLInputElement[]
    fireEvent.click(boxes[1])
    expect(boxes[3].checked).toBe(true)
  })

  it('follows the store selection: target first, then stop', () => {
    useMission.getState().selectStop('s1')
    const { rerender } = render(<StopCard variant="console" />)
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('SYNTHETIC stop 1')
    useMission.getState().selectTarget('t1')
    rerender(<StopCard variant="console" />)
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('SYNTHETIC target 1')
  })

  it('shows an empty state without a selection or for an unknown id', () => {
    const { rerender } = render(<StopCard variant="console" />)
    expect(screen.getByText('Select a stop or target.')).toBeTruthy()
    rerender(<StopCard variant="console" id="nope" />)
    expect(screen.getByText('No content for nope.')).toBeTruthy()
  })

  it('pages through several photos and keeps each credit visible', () => {
    const s1 = fixtureStops().stops.s1
    const second = { ...s1.photos[0], file: 'photos/b.jpg', credit: 'Second credit', sol: 1201 }
    render(<StopCard variant="cuff" content={{ ...s1, photos: [s1.photos[0], second] }} />)
    expect(screen.getByText('1 / 2')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Next photo' }))
    expect(screen.getByText('2 / 2')).toBeTruthy()
    expect(screen.getByTestId('photo-credit').textContent).toBe('Credit: Second credit')
    // Content passed directly is not the fixture: no SYNTHETIC badge from the loader.
    expect(screen.queryByText('SYNTHETIC')).toBeNull()
  })
})

describe('DevStopsPage', () => {
  it('renders every fixture stop in both variants', () => {
    render(<DevStopsPage />)
    const cards = screen.getAllByTestId('stop-card')
    expect(cards).toHaveLength(4)
    expect(cards.map((c) => c.dataset.variant)).toEqual(['console', 'cuff', 'console', 'cuff'])
    expect(screen.queryByTestId('dev-stop-errors')).toBeNull()
  })
})
