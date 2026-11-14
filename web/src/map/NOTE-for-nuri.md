# Note for Nuri (from Y2, Yusuf)

`web/src/map/` now exports `MapView`, `LayerToggle`, `fixtureSource`, `remoteSource` and the layer
registry. Two small changes in your files are needed to see the map; please fold them into N1/N6.

1. **`web/vite.config.ts`:** let the dev server read `contracts/fixtures/` (outside `web/`):

   ```ts
   server: {
     port: 5173,
     fs: { allow: ['..'] },
     // ...proxy as now
   },
   ```

   Without it `npm run dev` returns 403 for the fixture files. `npm run build` works either way.

2. **Mount the map** on the console route (N1 now, N6 final layout). The map fills its parent, so
   give the parent a height:

   ```tsx
   import { LayerToggle, MapView, fixtureSource, remoteSource } from '../map'

   // DEMO / until A2 publishes real assets:
   <div style={{ height: '100%' }}><MapView source={fixtureSource()} /></div>
   <LayerToggle />

   // Real data (aoi from contracts/aoi.json):
   <MapView source={remoteSource(aoi, import.meta.env.VITE_ASSETS_URL)} />
   ```

   Call `fixtureSource()` once (e.g. `useMemo`) so the map does not reload its layers on every render.

Checked locally with both changes applied temporarily: fixture ortho north-up, pan, zoom, scale
bar, cursor readout, Fit AOI and the layer toggle all work, no console errors. Delete this file
once both are in main.
