# Gestor de Canciones – PWA (GitHub Pages)

Repositorio: https://github.com/P4bl0AGT/Gestor-de-Canciones

## Instalar
```bash
npm i
```

## Desarrollo
> Para desarrollo local puedes dejar `base: '/'` y `start_url/scope: '/'`, pero este repo ya viene configurado para GH Pages con base `/Gestor-de-Canciones/`.
```bash
npm run dev
```

## Build y Deploy (GH Pages)
```bash
npm run build
npm run deploy
```
Luego en GitHub: Settings → Pages → Source: **gh-pages** branch.

**Importante**: la `base` de Vite está fijada a `/Gestor-de-Canciones/` y el `manifest` también. Si cambias el nombre del repo, actualiza ambos archivos.
