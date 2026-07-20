import json
import urllib.parse
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, Form, HTTPException, Request
from fastapi.responses import HTMLResponse, Response
from fastapi.templating import Jinja2Templates

from backend.auth_deps import require_auth
from .services.pricing_service import (
    build_whatsapp_link,
    build_whatsapp_message,
    compute_quote,
    generate_quote_pdf,
    get_quote,
    get_settings,
    list_machines,
    list_materials,
    list_quotes,
    remove_machine,
    remove_material,
    remove_quote,
    save_quote,
    update_quote,
    update_quote_status,
    update_settings,
    upsert_machine,
    upsert_material,
)

router = APIRouter()

# Instancia propia (no la de NOPAL core) apuntada a backend/templates/ DE ESTE
# PLUGIN -- a diferencia de PRICING_CONFIG_PATH/QUOTES_REGISTRY_PATH en
# pricing_service.py (que a propósito quedan como rutas relativas al cwd del
# proceso, es decir la raíz del checkout de NOPAL, para no requerir ninguna
# migración de datos), esta ruta SÍ depende de __file__: quote_print.html
# vive físicamente dentro de este plugin, no en NOPAL core.
_templates = Jinja2Templates(directory=str(Path(__file__).resolve().parent / "templates"))


@router.get("/api/pricing/materials")
async def pricing_materials_list_endpoint(user: dict = Depends(require_auth)):
    """Catálogo de materiales (filamento/lámina/consumible) para el cotizador."""
    return {"materials": list_materials()}


@router.post("/api/pricing/materials")
async def pricing_materials_upsert_endpoint(
    name: str = Form(...),
    kind: str = Form(...),
    unit_cost: float = Form(...),
    unit: str = Form(...),
    config: str = Form("{}"),
    id: Optional[str] = Form(None),
    user: dict = Depends(require_auth),
):
    """Da de alta o edita (si se manda `id`) un material. `config` es un JSON
    con los campos específicos del tipo — filamento: density_g_cm3,
    diameter_mm; lámina: thickness_mm; consumible: sin campos extra."""
    try:
        extra = json.loads(config)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="El campo 'config' no es un JSON válido")

    try:
        entry = upsert_material(name, kind, unit_cost, unit, extra, material_id=id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return entry


@router.post("/api/pricing/materials/remove")
async def pricing_materials_remove_endpoint(id: str = Form(...), user: dict = Depends(require_auth)):
    if not remove_material(id):
        raise HTTPException(status_code=404, detail="Material no encontrado")
    return {"success": True}


@router.get("/api/pricing/machines")
async def pricing_machines_list_endpoint(user: dict = Depends(require_auth)):
    """Catálogo de perfiles de costo por máquina (nombre, watts, tarifa/hora)
    — no son los dispositivos reales del registro de impresoras/láser/CNC."""
    return {"machines": list_machines()}


@router.post("/api/pricing/machines")
async def pricing_machines_upsert_endpoint(
    name: str = Form(...),
    kind: str = Form(...),
    watts: float = Form(...),
    rate_per_hour: float = Form(...),
    id: Optional[str] = Form(None),
    user: dict = Depends(require_auth),
):
    try:
        entry = upsert_machine(name, kind, watts, rate_per_hour, machine_id=id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return entry


@router.post("/api/pricing/machines/remove")
async def pricing_machines_remove_endpoint(id: str = Form(...), user: dict = Depends(require_auth)):
    if not remove_machine(id):
        raise HTTPException(status_code=404, detail="Máquina no encontrada")
    return {"success": True}


@router.get("/api/pricing/settings")
async def pricing_settings_get_endpoint(user: dict = Depends(require_auth)):
    return get_settings()


@router.post("/api/pricing/settings")
async def pricing_settings_update_endpoint(
    currency: Optional[str] = Form(None),
    price_per_kwh: Optional[float] = Form(None),
    machine_watts_default: Optional[str] = Form(None),
    margin: Optional[str] = Form(None),
    labor_rate_per_hour: Optional[float] = Form(None),
    default_prep_minutes: Optional[float] = Form(None),
    whatsapp_message_template: Optional[str] = Form(None),
    user: dict = Depends(require_auth),
):
    """Ajustes globales del cotizador. `machine_watts_default` y `margin` son
    JSON (ej. `{"printer": 250, "laser": 150, "cnc": 800}` y
    `{"mode": "percentage", "percentage": 30, "flat_amount": 0}`)."""
    try:
        watts_dict = json.loads(machine_watts_default) if machine_watts_default else None
        margin_dict = json.loads(margin) if margin else None
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="JSON inválido en 'machine_watts_default' o 'margin'")

    return update_settings(
        currency, price_per_kwh, watts_dict, margin_dict, labor_rate_per_hour, default_prep_minutes,
        whatsapp_message_template,
    )


@router.post("/api/pricing/quote")
def pricing_quote_endpoint(
    path: str = Form(...),
    section: str = Form("model"),
    material_id: str = Form(...),
    quantity: float = Form(1),
    overrides: str = Form("{}"),
    machine_id: Optional[str] = Form(None),
    extra_costs: str = Form("[]"),
    user: dict = Depends(require_auth),
):
    """Cotiza un archivo ya subido (modelo/gcode) contra un material del
    catálogo. Sin `async` a propósito: la extracción de filamento (metadata +
    fallback por eje E) o de geometría láser/CNC puede tardar en archivos
    grandes — la primera vez, después queda cacheada por mtime — y si el
    endpoint fuera async esos segundos bloquean el event loop entero de
    FastAPI, igual que se resolvió para /api/gcode/thumbnail. Con `def`
    normal, Starlette lo corre en su threadpool."""
    try:
        overrides_dict = json.loads(overrides)
        extra_costs_list = json.loads(extra_costs)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="El campo 'overrides' o 'extra_costs' no es un JSON válido")

    try:
        return compute_quote(section, path, material_id, quantity, overrides_dict, machine_id, extra_costs_list)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Archivo no encontrado")
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/api/pricing/quotes")
async def pricing_quotes_list_endpoint(user: dict = Depends(require_auth)):
    """Historial de cotizaciones guardadas, para la tabla de 'Cotizaciones
    recientes' — más nuevas primero."""
    return {"quotes": list_quotes()}


@router.get("/api/pricing/quotes/{quote_id}")
async def pricing_quotes_detail_endpoint(quote_id: str, user: dict = Depends(require_auth)):
    quote = get_quote(quote_id)
    if quote is None:
        raise HTTPException(status_code=404, detail="Cotización no encontrada")
    return quote


@router.post("/api/pricing/quotes")
async def pricing_quotes_save_endpoint(quote: str = Form(...), user: dict = Depends(require_auth)):
    """Guarda una cotización ya calculada (el JSON completo que devolvió
    /api/pricing/quote, más los campos de encabezado que arma el frontend:
    cliente, notas, vigencia) — no se recalcula nada acá."""
    try:
        quote_dict = json.loads(quote)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="El campo 'quote' no es un JSON válido")
    return save_quote(quote_dict)


@router.put("/api/pricing/quotes/{quote_id}")
async def pricing_quotes_update_endpoint(quote_id: str, quote: str = Form(...), user: dict = Depends(require_auth)):
    try:
        quote_dict = json.loads(quote)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="El campo 'quote' no es un JSON válido")
    updated = update_quote(quote_id, quote_dict)
    if updated is None:
        raise HTTPException(status_code=404, detail="Cotización no encontrada")
    return updated


@router.delete("/api/pricing/quotes/{quote_id}")
async def pricing_quotes_delete_endpoint(quote_id: str, user: dict = Depends(require_auth)):
    if not remove_quote(quote_id):
        raise HTTPException(status_code=404, detail="Cotización no encontrada")
    return {"success": True}


@router.post("/api/pricing/quotes/{quote_id}/status")
async def pricing_quotes_status_endpoint(quote_id: str, status: str = Form(...), user: dict = Depends(require_auth)):
    """'Enviar cotización' desde la UI solo llama esto con status='sent' —
    no manda ningún correo real, no hay SMTP configurado en el proyecto."""
    entry = update_quote_status(quote_id, status)
    if entry is None:
        raise HTTPException(status_code=404, detail="Cotización no encontrada")
    return entry


@router.get("/api/pricing/quotes/{quote_id}/pdf")
async def pricing_quote_pdf_endpoint(quote_id: str, download: bool = False, user: dict = Depends(require_auth)):
    """PDF real de la cotización (tabla de costos, no una captura de la
    página) — `download=true` fuerza que el navegador lo baje en vez de
    mostrarlo inline, para el flujo de 'Enviar por WhatsApp' (adjuntarlo a
    mano después de descargarlo, ver frontend)."""
    pdf_bytes = generate_quote_pdf(quote_id)
    if pdf_bytes is None:
        raise HTTPException(status_code=404, detail="Cotización no encontrada")
    disposition = "attachment" if download else "inline"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'{disposition}; filename="Cotizacion_{quote_id}.pdf"'},
    )


@router.get("/api/pricing/quotes/{quote_id}/whatsapp-link")
async def pricing_quote_whatsapp_link_endpoint(
    quote_id: str, request: Request, message: Optional[str] = None, user: dict = Depends(require_auth)
):
    """Devuelve el mensaje (default, o el mensaje personal configurado en
    Ajustes, o el `message` que mande el frontend ya editado) y la URL
    wa.me ya armada con ese texto — no manda nada por sí sola, el frontend
    la abre en pestaña nueva y el usuario aprieta 'Enviar' del lado de
    WhatsApp. Sin `message`, sirve para previsualizar el texto por default
    antes de que el usuario lo edite. No requiere client_phone: si el quote
    no lo tiene guardado, el link queda sin número de destino y WhatsApp
    deja elegir el contacto a mano (ver build_whatsapp_link)."""
    quote = get_quote(quote_id)
    if quote is None:
        raise HTTPException(status_code=404, detail="Cotización no encontrada")

    print_url = str(request.base_url).rstrip("/") + f"/cotizador/print/{quote_id}"
    text = message.strip() if message and message.strip() else build_whatsapp_message(quote, print_url)
    return {"url": build_whatsapp_link(quote, text), "message": text}


@router.get("/cotizador/print/{quote_id}", response_class=HTMLResponse)
async def print_quote(request: Request, quote_id: str, user: dict = Depends(require_auth)):
    """Vista imprimible de una cotización guardada — el usuario la exporta a
    PDF con el diálogo nativo del navegador (Ctrl+P). No hay librería de
    generación de PDF en el proyecto; agregar una para esto sería una
    dependencia nueva para algo que el navegador ya resuelve solo."""
    quote = get_quote(quote_id)
    if quote is None:
        return HTMLResponse(content="<h1>Cotización no encontrada</h1>", status_code=404)

    created_at = quote.get("created_at")
    created_at_str = datetime.fromtimestamp(created_at).strftime("%d/%m/%Y %H:%M") if created_at else "—"

    # Mismas miniaturas ya usadas en el resto de la app: incrustada del
    # slicer para impresión 3D (puede no existir en un STL sin laminar),
    # trazado real para láser/CNC (esa nunca da 404). El "kind" solo define
    # el color del trazo (ver COLOR_BY_KIND en thumbnail_service.py), no
    # afecta si hay imagen o no — un valor por defecto es inofensivo en
    # cotizaciones viejas que no guardaron job_type.
    file_info = quote.get("file") or {}
    job_type = quote.get("job_type", "")
    thumb_kind = {"printer": "printer", "laser_cut": "laser", "laser_engrave": "laser", "cnc": "cnc"}.get(job_type, "cnc")
    thumbnail_url = None
    if file_info.get("path"):
        section = file_info.get("section", "model")
        encoded_path = urllib.parse.quote(file_info["path"])
        if section == "gcode":
            thumbnail_url = f"/api/gcode/thumbnail?path={encoded_path}&kind={thumb_kind}"
        else:
            thumbnail_url = f"/api/models/thumbnail?path={encoded_path}&section=model"

    return _templates.TemplateResponse(
        request=request,
        name="quote_print.html",
        context={"quote": quote, "created_at_str": created_at_str, "thumbnail_url": thumbnail_url},
    )
