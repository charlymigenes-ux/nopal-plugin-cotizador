# Cotizador (plugin de NOPAL)

Calcula el costo estimado de un trabajo de impresión 3D, corte/grabado láser
o CNC a partir de un archivo ya subido a la biblioteca (material, energía,
uso de máquina, mano de obra, consumibles y margen), y arma una cotización
lista para guardar, imprimir en PDF o reenviar por WhatsApp. Incluye un
catálogo propio de materiales y perfiles de costo por máquina (no son los
dispositivos reales registrados en Impresoras/Láser/CNC — acá solo importa
"cuánto cuesta usarla"), ajustes globales (moneda, precio del kWh, margen,
tarifa de mano de obra) e historial de cotizaciones guardadas.

## Instalación

Desde NOPAL → Configuración → Galería de plugins → Cotizador → Instalar.
NOPAL clona este repo a `plugins/cotizador/` y carga su backend/frontend
automáticamente — no requiere pasos manuales.

## Desarrollo

Este plugin corre **en proceso con NOPAL** (no está sandboxeado): su backend
importa `backend.auth_deps`, `backend.services.gcode_geometry` y
`backend.utils` de NOPAL core con import absoluto (no son parte de este
plugin, son una dependencia real e intencional — mismo patrón ya usado por
otros plugins de este repositorio), y depende de que NOPAL lo cargue vía
`backend/services/plugin_loader_service.py` (imports relativos dentro de
`backend/` para que `router.py` pueda usar `from .services.pricing_service
import ...`).

Los datos del cotizador (`pricing_config.json`, `quotes_registry.json` y la
carpeta de caché `uploads/.pricing_cache/`) se guardan en la raíz del
checkout de NOPAL, no dentro de este plugin — son rutas relativas al
directorio de trabajo del proceso de NOPAL, a propósito, para que instalar
este plugin sobre una instancia que ya tenía el Cotizador integrado en el
core (antes de esta extracción) siga leyendo el mismo historial sin ninguna
migración manual. El PDF (`generate_quote_pdf`) también usa una plantilla
(`quote_pdf.html`) que sigue viviendo en `backend/templates/` de NOPAL core
por el mismo motivo (ruta relativa al cwd del proceso, no a este plugin) —
la única plantilla que sí se movió a este repo es `quote_print.html` (la
vista `/cotizador/print/{id}`, que ahora la sirve el router de este plugin
con su propia instancia de `Jinja2Templates` apuntada a `backend/templates/`
de acá).

En el frontend, el plugin sigue dependiendo de varios helpers internos de
`app.js` que no forman parte del contrato "oficial" de plugins de NOPAL
(los 5 ya usados por otros plugins: `escapeHtml`, `showToast`, `appConfirm`,
`switchSection`, `applySidebarOrder`): el visor de miniaturas de G-code/STL
(`loadRealGcodeThumbnail`, `renderStandardModelPreview`,
`renderCncGcodeThumbnail`), el explorador de archivos de la biblioteca
(`formatSize`, `isGcodeFile`, `stripSectionPrefix`), los widgets de opción y
menú superior (`createOptionSwitch`, `wireTopbarDropdown`,
`closeAllTopbarDropdowns`) y `appAlert`. Esto es una diferencia real frente a
plugins más autocontenidos como Cámaras o Accesorios Arduino: el Cotizador
reutiliza la vista de archivos y las miniaturas que ya existen en NOPAL core
en vez de duplicarlas, así que necesita correr junto a una versión de
`app.js` que siga exportando esas funciones.

Estructura:
```
nopal-plugin.json      # manifest (versión, entry points de frontend/backend)
frontend/               # cotizador.js + .css, patrón NopalPluginRegistry
backend/
  router.py             # FastAPI APIRouter (entry point declarado en el manifest) + vista imprimible /cotizador/print/{id}
  templates/
    quote_print.html    # vista HTML imprimible de una cotización guardada
  services/
    pricing_service.py  # extracción de filamento/geometría, cálculo de costos, catálogos, historial, PDF
```

### Correr los tests

Los tests necesitan un checkout de [NOPAL core](https://github.com/charlymigenes-ux/nopal)
accesible (con sus dependencias de `requirements-dev.txt` instaladas) porque
este plugin depende de `backend.auth_deps`/`backend.services.gcode_geometry`/
`backend.utils` en tiempo de ejecución:

```bash
# Si este repo está clonado en plugins/cotizador/ de un checkout de NOPAL:
cd plugins/cotizador
pytest

# Si está en otro lado:
NOPAL_CORE_ROOT=/ruta/al/checkout/de/nopal pytest
```

## Limitaciones conocidas

- No vuelve a laminar el archivo: usa el tiempo/peso que ya trae el G-code
  (metadata del slicer o, a falta de eso, el eje E) — un STL/3MF sin
  laminar solo puede cotizarse contra un material tipo "lámina"/"consumible",
  no "filamento".
- El PDF de la cotización (`generate_quote_pdf`) usa `xhtml2pdf`, que
  necesita estar instalado en el entorno donde corre NOPAL.
- "Enviar por WhatsApp" no manda nada por sí solo: abre `wa.me` con el
  mensaje prellenado y descarga el PDF para que el usuario lo adjunte a
  mano — no hay integración real con la API de WhatsApp Business.
