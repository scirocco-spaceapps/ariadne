import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { LayerToggle } from './LayerToggle'
import { useLayerRegistry } from './layers'

beforeEach(() => {
  useLayerRegistry.setState({ layers: [] })
  const { register } = useLayerRegistry.getState()
  register({ id: 'ortho', label: 'Orthoimage', provenance: 'Observed', visible: true })
  register({ id: 'slope', label: 'Slope', provenance: 'Derived', visible: false })
})
afterEach(cleanup)

describe('LayerToggle', () => {
  it('lists every registered layer with its provenance', () => {
    render(<LayerToggle />)
    expect(screen.getByLabelText(/Orthoimage/)).toBeTruthy()
    expect(screen.getByText('Observed')).toBeTruthy()
    expect(screen.getByText('Derived')).toBeTruthy()
  })

  it('switches a layer in the registry when its checkbox is clicked', () => {
    render(<LayerToggle />)
    const slope = screen.getByLabelText(/Slope/) as HTMLInputElement
    expect(slope.checked).toBe(false)
    fireEvent.click(slope)
    expect(slope.checked).toBe(true)
    expect(useLayerRegistry.getState().layers.find((l) => l.id === 'slope')?.visible).toBe(true)
  })

  it('keeps visibility when a layer registers again', () => {
    useLayerRegistry.getState().setVisible('ortho', false)
    useLayerRegistry.getState().register({ id: 'ortho', label: 'Ortho v2', provenance: 'Observed', visible: true })
    const ortho = useLayerRegistry.getState().layers.find((l) => l.id === 'ortho')
    expect(ortho).toMatchObject({ label: 'Ortho v2', visible: false })
  })
})
