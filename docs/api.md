---
title: Cotizador: API
status: draft
verified_against: "nopal-plugin-cotizador@64d1394 (1.1.0) · nopal@4346f72"
generated: true
---

# Cotizador: API

> Página **generada** desde el código del plugin. No la edites a mano.

Prefijo(s) de ruta: `/api/pricing`, `/cotizador/print` · 18 rutas (Sesión (admin u operador): 18; Solo admin: 0; Pública: 0).

| Método | Ruta | Acceso | Política | Descripción |
|---|---|---|---|---|
| GET | `/api/pricing/machines` | Sesión (admin u operador) | — | Catálogo de perfiles de costo por máquina (nombre, watts, tarifa/hora) — no son los dispositivos reales del registro de impresoras/láser/CN… |
| POST | `/api/pricing/machines` | Sesión (admin u operador) | — | — |
| POST | `/api/pricing/machines/remove` | Sesión (admin u operador) | — | — |
| GET | `/api/pricing/materials` | Sesión (admin u operador) | — | Catálogo de materiales (filamento/lámina/consumible) para el cotizador. |
| POST | `/api/pricing/materials` | Sesión (admin u operador) | — | Da de alta o edita (si se manda `id`) un material. `config` es un JSON con los campos específicos del tipo — filamento: density_g_cm3, diam… |
| POST | `/api/pricing/materials/remove` | Sesión (admin u operador) | — | — |
| POST | `/api/pricing/quote` | Sesión (admin u operador) | — | Cotiza un archivo ya subido (modelo/gcode) contra un material del catálogo. Sin `async` a propósito: la extracción de filamento (metadata +… |
| GET | `/api/pricing/quotes` | Sesión (admin u operador) | — | Historial de cotizaciones guardadas, para la tabla de 'Cotizaciones recientes' — más nuevas primero. |
| POST | `/api/pricing/quotes` | Sesión (admin u operador) | — | Guarda una cotización ya calculada (el JSON completo que devolvió /api/pricing/quote, más los campos de encabezado que arma el frontend: cl… |
| GET | `/api/pricing/quotes/{quote_id}` | Sesión (admin u operador) | — | — |
| PUT | `/api/pricing/quotes/{quote_id}` | Sesión (admin u operador) | — | — |
| DELETE | `/api/pricing/quotes/{quote_id}` | Sesión (admin u operador) | — | — |
| GET | `/api/pricing/quotes/{quote_id}/pdf` | Sesión (admin u operador) | — | PDF real de la cotización (tabla de costos, no una captura de la página) — `download=true` fuerza que el navegador lo baje en vez de mostra… |
| POST | `/api/pricing/quotes/{quote_id}/status` | Sesión (admin u operador) | — | 'Enviar cotización' desde la UI solo llama esto con status='sent' — no manda ningún correo real, no hay SMTP configurado en el proyecto. |
| GET | `/api/pricing/quotes/{quote_id}/whatsapp-link` | Sesión (admin u operador) | — | Devuelve el mensaje (default, o el mensaje personal configurado en Ajustes, o el `message` que mande el frontend ya editado) y la URL wa.me… |
| GET | `/api/pricing/settings` | Sesión (admin u operador) | — | — |
| POST | `/api/pricing/settings` | Sesión (admin u operador) | — | Ajustes globales del cotizador. `machine_watts_default` y `margin` son JSON (ej. `{"printer": 250, "laser": 150, "cnc": 800}` y `{"mode": "… |
| GET | `/cotizador/print/{quote_id}` | Sesión (admin u operador) | — | Vista imprimible de una cotización guardada — el usuario la exporta a PDF con el diálogo nativo del navegador (Ctrl+P). No hay librería de… |

El acceso mostrado es el declarado en cada ruta (`require_auth`, `require_role("admin")`). Una comprobación de rol dentro del cuerpo de la función no se detecta.
