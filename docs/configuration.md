---
title: Cotizador: configuración
status: draft
verified_against: "nopal-plugin-cotizador@64d1394 (1.1.0) · nopal@4346f72"
---


# Configuración

## Archivos

Los datos se guardan en la **raíz de la instalación de NOPAL**, no dentro del plugin, a propósito: así, instalar el plugin sobre una instancia que ya tenía el Cotizador integrado en el core sigue leyendo el mismo historial sin migración.

| Ruta | Contenido |
|---|---|
| `pricing_config.json` | Ajustes globales y catálogos (materiales y perfiles de máquina) |
| `quotes_registry.json` | Historial de cotizaciones |
| `uploads/.pricing_cache/` | Caché de extracción de datos de los archivos |

Estos archivos se incluyen en los **respaldos de configuración** de NOPAL (grupo *Cotizador*).

## Plantillas

| Plantilla | Dónde vive |
|---|---|
| `quote_print.html` | En este plugin (`backend/templates/`): la sirve el router del plugin en `/cotizador/print/{id}` |
| `quote_pdf.html` | En **`backend/templates/` del core**, por compatibilidad con rutas relativas al directorio de trabajo |

## Permisos declarados (informativos)

Leer archivos de la biblioteca, guardar catálogos de materiales y máquinas, y guardar el historial de cotizaciones.
