---
title: Cotizador: visión general
status: draft
verified_against: "nopal-plugin-cotizador@64d1394 (1.1.0) · nopal@4346f72"
---


# Cotizador

Calcula el **costo estimado** de un trabajo de impresión 3D, corte/grabado láser o CNC a partir de un archivo ya subido a la biblioteca, y arma una **cotización** lista para guardar, imprimir en PDF o reenviar.

## Qué cuenta el costo

Material, energía, uso de máquina, mano de obra, consumibles y margen.

## Qué incluye

- Un **catálogo propio de materiales** y **perfiles de costo por máquina**. No son los dispositivos reales registrados en Impresoras/Láser/CNC: aquí solo importa cuánto cuesta usar la máquina.
- **Ajustes globales**: moneda, precio del kWh, margen y tarifa de mano de obra.
- **Historial** de cotizaciones guardadas.
- **Salida**: guardar, imprimir en PDF, vista imprimible (`/cotizador/print/{id}`) y «enviar por WhatsApp».

## Integración con Materiales

Con el plugin Materiales (Spoolman) instalado, un material con la forma `spoolman:<id_de_carrete>` toma su costo real desde el inventario.

[Instalación](installation.md) · [Configuración](configuration.md) · [API](api.md) · [Solución de problemas](troubleshooting.md)
