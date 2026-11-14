import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { App } from './App'

afterEach(cleanup)

describe('routes', () => {
  it('renders the console placeholder at /', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { name: /mission console/i })).toBeTruthy()
  })

  it('renders the cuff placeholder at /cuff', () => {
    render(
      <MemoryRouter initialEntries={['/cuff']}>
        <App />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { name: /cuff/i })).toBeTruthy()
  })
})
