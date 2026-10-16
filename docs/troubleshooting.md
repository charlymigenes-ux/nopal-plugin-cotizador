---
title: Cotizador: solución de problemas
status: draft
verified_against: "nopal-plugin-cotizador@64d1394 (1.1.0) · nopal@4346f72"
---


# Solución de problemas

| Problema | Causa y qué hacer |
|---|---|
| Un STL/3MF sin laminar no se puede cotizar con material «filamento» | El plugin **no vuelve a laminar**: usa el tiempo y el peso que ya trae el G-code (metadatos del *slicer* o, a falta de eso, el eje E). Un STL/3MF sin laminar solo puede cotizarse con un material tipo «lámina» o «consumible» |
| El PDF no se genera | Falta `xhtml2pdf` en el entorno de NOPAL |
| «Enviar por WhatsApp» no envía nada | Solo abre `wa.me` con el mensaje prellenado y descarga el PDF para que lo adjuntes a mano. **No hay integración** con la API de WhatsApp Business |
| El costo del material no viene de Spoolman | Revisa que el material sea `spoolman:<id>` y que el plugin Materiales esté instalado |
| El plugin no se ve bien o falla al montarse | Depende de funciones internas de `app.js`. Una versión de NOPAL que las cambie puede romperlo |
