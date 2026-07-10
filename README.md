# Centro de Operacion Acuicola

Dashboard Vite + React para consumir el backend acuicola:

```bash
npm install
npm run dev
```

Variables:

```env
VITE_API_BASE_URL=/api/v1
VITE_API_TARGET_URL=http://37.60.226.53:8000
```

En desarrollo, Vite proxy reenvia `/api/v1` al backend local. En produccion, el contenedor Nginx reenvia `/api/v1` al contenedor FastAPI de la misma maquina virtual.

Para agregar un endpoint administrativo, edita `src/config/resources.ts` con `id`, `label`, `endpoint`, `columns` y `createFields`. La vista de gestion lo tomara automaticamente.
