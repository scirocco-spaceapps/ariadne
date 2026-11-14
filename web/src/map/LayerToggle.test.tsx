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

  it('lists the top layer first and shows a legend only while its layer is on', () => {
    useLayerRegistry.setState({ layers: [] })
    const { register } = useLayerRegistry.getState()
    register({ id: 'places', label: 'Stops', provenance: 'Derived', visible: true, order: 7 })
    register({
      id: 'slope',
      label: 'Slope',
      provenance: 'Derived',
      visible: false,
      order: 2,
      legend: [{ color: '#1a9850', label: '0-10°' }],
    })
    register({ id: 'ortho', label: 'Orthoimage', provenance: 'Observed', visible: true, order: 0 })
    render(<LayerToggle />)
    const labels = screen.getAllByRole('checkbox').map((c) => c.id)
    expect(labels).toEqual(['layer-places', 'layer-slope', 'layer-ortho'])
    expect(screen.queryByText('0-10°')).toBeNull()
    fireEvent.click(screen.getByLabelText(/Slope/))
    expect(screen.getByText('0-10°')).toBeTruthy()
  })

  it('keeps visibility when a layer registers again', () => {
    useLayerRegistry.getState().setVisible('ortho', false)
    useLayerRegistry.getState().register({ id: 'ortho', label: 'Ortho v2', provenance: 'Observed', visible: true })
    const ortho = useLayerRegistry.getState().layers.find((l) => l.id === 'ortho')
    expect(ortho).toMatchObject({ label: 'Ortho v2', visible: false })
  })
})
