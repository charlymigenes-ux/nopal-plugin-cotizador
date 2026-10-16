---
title: Cotizador: instalación
status: draft
verified_against: "nopal-plugin-cotizador@64d1394 (1.1.0) · nopal@4346f72"
---


# Instalación

1. **Configuración → Galería de plugins → Cotizador → Instalar.**
2. **Reinicia NOPAL** para cargar el backend.

## Requisitos

- Para generar **PDF**, la biblioteca `xhtml2pdf` debe estar instalada en el entorno de NOPAL (está en el `requirements.txt` del core).
- El plugin reutiliza partes internas del core: el visor de miniaturas de G-code/STL, el explorador de la biblioteca y varios widgets. Necesita correr junto a una versión de `app.js` que siga definiéndolas.
