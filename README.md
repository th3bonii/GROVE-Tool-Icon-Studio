# GROVE Tool Icon Studio

Aplicación de escritorio para generar y gestionar **íconos de barra de herramientas de 3 estados** para estaciones de audio digital [REAPER](https://reaper.fm). Construida con Tauri v2, React y Rust.

## Funcionalidades

- **Procesamiento de íconos** — Cargue imágenes PNG, recorte, ajuste el padding y genere íconos compatibles con REAPER en 3 escalas (100 %, 150 %, 200 %)
- **Modo toggle** — Genere variantes de estado ON/OFF con ajustes de color HSB independientes
- **Procesamiento por lotes** — Procese múltiples íconos a la vez con configuraciones compartidas
- **Ajuste de color HSB** — Ajuste fino de tono, saturación y brillo para cada estado del ícono de forma independiente
- **Vista previa en vivo** — Vea las 3 escalas y estados antes de instalar, tanto en vista de estados como de tiras
- **Integración con REAPER** — Instale íconos directamente en la estructura de directorios `toolbar_icons` de REAPER
- **Gestión de íconos** — Explore, previsualice, exporte y elimine íconos instalados desde la interfaz
- **Detección automática de REAPER** — Detecta el directorio de recursos de REAPER automáticamente en todas las plataformas

## Instalación

### Binarios precompilados

Descargue la última versión para su plataforma desde la [página de lanzamientos](https://github.com/th3bonii/GROVE-Tool-Icon-Studio/releases).

| Plataforma | Formato |
|------------|---------|
| Linux | `.deb` / `.AppImage` |
| macOS | `.dmg` |
| Windows | `.msi` / `.exe` |

### Compilar desde el código fuente

Consulte [DEPLOYMENT.md](DEPLOYMENT.md) para conocer los requisitos previos y las instrucciones de compilación para cada plataforma.

## Uso

1. **Seleccione la ruta de REAPER** — La aplicación detecta automáticamente el directorio de recursos de REAPER, o puede configurarlo manualmente
2. **Elija una imagen de origen** — Cargue cualquier imagen PNG (tamaño recomendado: 24–80 píxeles para íconos de barra de herramientas)
3. **Recorte y ajuste** — Recorte el área del ícono, establezca el padding, active el modo toggle si es necesario
4. **Ajuste de color** (opcional) — Ajuste fino de valores HSB para los estados OFF y ON
5. **Vista previa** — Vea cómo se verá el ícono en todas las escalas y estados
6. **Instale** — Asigne un nombre a su ícono e instálelo directamente en la barra de herramientas de REAPER
7. **Use en REAPER** — Abra el editor de barras de herramientas de REAPER y sus íconos estarán listos para usar

## Desarrollo

```bash
# Instalar dependencias
npm install

# Ejecutar en modo de desarrollo
npm run tauri dev

# Ejecutar pruebas
npm run test            # Pruebas TypeScript
cargo test --lib        # Pruebas Rust (desde src-tauri/)

# Compilar para producción
npm run tauri build
```

## Tecnologías

| Capa | Tecnología |
|------|------------|
| Frontend | React 18, TypeScript, Vite 6 |
| Backend | Rust, Tauri v2 |
| IPC | `@tauri-apps/api` (comandos invoke) |
| Pruebas | Vitest + @testing-library/react (TS), cargo test (Rust) |
| Procesamiento de imágenes | `image` crate (PNG, redimensionar, componer) |

## Licencia

MIT
