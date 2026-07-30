// Cotizador -- plugin de NOPAL (calculadora de precios).
//
// Extraído de NOPAL core (lift-and-shift, sin cambios de comportamiento):
// las funciones de acá abajo son las mismas que vivían en app.js, solo
// reempaquetadas como plugin self-mounting (patrón NopalPluginRegistry, ver
// arduino-accessories/camera-viewer para el mismo patrón). Los endpoints
// /api/pricing/* que consume no cambiaron de URL.
(function () {
    const PLUGIN_ID = 'cotizador';

    // Mismos wrappers defensivos que ya usan arduino-accessories/camera-viewer
    // para los 5 helpers "oficiales" de core que cualquier plugin puede dar
    // por sentado (escapeHtml/showToast/appConfirm/switchSection/
    // applySidebarOrder) -- ver window.* al final de mount()/unmount(). Acá
    // se agrega un 4to wrapper (alertDialog) porque el código movido también
    // usaba appAlert() con la misma frecuencia, aunque ningún otro plugin lo
    // necesitaba todavía.
    const esc = value => typeof window.escapeHtml === 'function' ? window.escapeHtml(value) : String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
    const toast = (message, tone = 'success') => typeof window.showToast === 'function' ? window.showToast(message, tone) : console.log(message);
    const confirmDialog = (message, title = '') => typeof window.appConfirm === 'function' ? window.appConfirm(message, title) : Promise.resolve(window.confirm(message));
    const alertDialog = (message, title = '', type = 'danger') => typeof window.appAlert === 'function' ? window.appAlert(message, title, type) : window.alert(message);

    let root = null;
    let modalRoots = [];

    // ── Cotizador ──

    const PRICING_JOB_TYPE_MAP = {
        printer: { section: 'model', machineKind: 'printer', materialKind: 'filament' },
        laser_cut: { section: 'gcode', machineKind: 'laser', materialKind: null },
        laser_engrave: { section: 'gcode', machineKind: 'laser', materialKind: null },
        cnc: { section: 'gcode', machineKind: 'cnc', materialKind: null },
    };

    const PRICING_JOB_TYPE_LABELS = {
        printer: 'Impresión 3D',
        laser_cut: 'Corte Láser',
        laser_engrave: 'Grabado Láser',
        cnc: 'CNC',
    };

    const PRICING_COST_LINE_LABELS = {
        material: 'Material',
        electricity: 'Energía',
        machine_usage: 'Uso de máquina',
        labor: 'Mano de obra',
        consumables: 'Consumibles',
        additional: 'Costos adicionales',
    };

    const PRICING_STATUS_LABELS = {
        draft: 'Borrador',
        sent: 'Enviada',
        approved: 'Aprobada',
        rejected: 'Rechazada',
    };


    let pricingJobType = 'printer';
    let pricingBrowsePath = '';
    let pricingBrowseData = { folders: [], files: [] };
    let pricingSelectedFile = null;
    let pricingMachines = [];
    let pricingMaterials = [];
    let pricingExtraCosts = [];
    let pricingLastQuoteResult = null;
    let pricingLastSavedQuoteId = null;
    let pricingLastLoadedQuoteId = null;
    let pricingQuoteRequestTimer = null;
    let pricingQuoteDate = null;
    let pricingWired = false;
    let pricingWhatsappQuoteId = null;
    let materialAddKindSwitch = null;
    let machineAddKindSwitch = null;
    let settingsMarginModeSwitch = null;

    // ── Integración con el plugin Materiales (Spoolman) ──
    // Cotizador no depende de que Spoolman esté instalado: si no está, o no
    // está configurado, el selector de carrete simplemente no aparece (o
    // muestra un aviso) y el cotizador sigue funcionando con el catálogo de
    // materiales genéricos de siempre. Nunca se inventa un costo si no hay
    // datos reales de Spoolman.
    let spoolmanPluginInstalled = false;
    let spoolmanConfigured = false;
    let spoolmanSpools = [];
    let pricingLinkedSpoolId = '';

    function pricingSection() {
        return PRICING_JOB_TYPE_MAP[pricingJobType].section;
    }

    function pricingJobTypeLabel(type) {
        return PRICING_JOB_TYPE_LABELS[type] || '—';
    }

    function _formatMinutes(totalMinutes) {
        const m = Math.round(totalMinutes);
        const h = Math.floor(m / 60);
        const mm = m % 60;
        return h ? `${h}h ${mm}m` : `${mm}m`;
    }

    function ensurePricingValidUntilDefault() {
        const input = document.getElementById('pricing-valid-until-input');
        if (input && !input.value) {
            const d = new Date();
            d.setDate(d.getDate() + 7);
            input.value = d.toISOString().slice(0, 10);
        }
    }

    async function loadPricingSection() {
        wirePricingSection();
        updatePricingJobTypeTheme();
        await loadPricingCatalogs();
        await loadPricingFileBrowser(pricingBrowsePath);
        renderPricingExtraCosts();
        loadPricingQuotesHistory();
        ensurePricingValidUntilDefault();
        updatePricingBreadcrumbState();
        schedulePricingQuoteRefresh();
    }

    function wirePricingSection() {
        if (pricingWired) return;
        pricingWired = true;

        document.querySelectorAll('#pricing-job-type-switch .option-switch-btn').forEach(btn => {
            btn.addEventListener('click', () => setPricingJobType(btn.dataset.value));
        });
        document.querySelectorAll('#pricing-detail-level-switch .option-switch-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('#pricing-detail-level-switch .option-switch-btn').forEach(b => b.classList.toggle('active', b === btn));
                pricingLastSavedQuoteId = null;
                schedulePricingQuoteRefresh();
            });
        });

        document.getElementById('pricing-machine-select')?.addEventListener('change', () => {
            pricingLastSavedQuoteId = null;
            schedulePricingQuoteRefresh();
        });
        document.getElementById('pricing-material-select')?.addEventListener('change', () => {
            pricingLastSavedQuoteId = null;
            schedulePricingQuoteRefresh();
        });
        document.getElementById('pricing-color-select')?.addEventListener('change', () => { pricingLastSavedQuoteId = null; });
        document.getElementById('pricing-spoolman-select')?.addEventListener('change', event => {
            pricingLinkedSpoolId = event.target.value;
            pricingLastSavedQuoteId = null;
            renderSpoolmanSpoolInfo();
            schedulePricingQuoteRefresh();
        });

        const qtyInput = document.getElementById('pricing-quantity-input');
        qtyInput?.addEventListener('input', () => {
            pricingLastSavedQuoteId = null;
            schedulePricingQuoteRefresh();
        });
        document.getElementById('pricing-qty-minus')?.addEventListener('click', () => {
            if (!qtyInput) return;
            qtyInput.value = Math.max(1, (parseInt(qtyInput.value, 10) || 1) - 1);
            qtyInput.dispatchEvent(new Event('input'));
        });
        document.getElementById('pricing-qty-plus')?.addEventListener('click', () => {
            if (!qtyInput) return;
            qtyInput.value = (parseInt(qtyInput.value, 10) || 1) + 1;
            qtyInput.dispatchEvent(new Event('input'));
        });

        document.getElementById('pricing-currency-select')?.addEventListener('change', () => renderPricingCostSummary(pricingLastQuoteResult));
        document.getElementById('pricing-exchange-rate-input')?.addEventListener('input', () => renderPricingCostSummary(pricingLastQuoteResult));

        document.getElementById('pricing-add-extra-cost-btn')?.addEventListener('click', addPricingExtraCostRow);
        document.getElementById('pricing-replace-file-btn')?.addEventListener('click', showPricingFileBrowserAgain);
        document.getElementById('pricing-new-quote-btn')?.addEventListener('click', resetPricingWizard);
        document.getElementById('pricing-discard-btn')?.addEventListener('click', resetPricingWizard);
        document.getElementById('pricing-copy-id-btn')?.addEventListener('click', copyPricingQuoteId);

        document.getElementById('pricing-save-btn')?.addEventListener('click', savePricingQuote);
        document.getElementById('pricing-print-btn')?.addEventListener('click', () => openPricingPrintPreview());
        document.getElementById('pricing-send-btn')?.addEventListener('click', () => sendPricingQuoteAction());
        document.getElementById('pricing-whatsapp-btn')?.addEventListener('click', () => openPricingWhatsappModal());

        document.getElementById('pricing-whatsapp-confirm-btn')?.addEventListener('click', confirmPricingWhatsappSend);
        document.getElementById('pricing-whatsapp-cancel-btn')?.addEventListener('click', closePricingWhatsappModal);
        document.getElementById('pricing-whatsapp-modal-close')?.addEventListener('click', closePricingWhatsappModal);
        document.getElementById('pricing-whatsapp-modal-backdrop')?.addEventListener('click', closePricingWhatsappModal);

        wireTopbarDropdown('pricing-header-menu-btn', 'pricing-header-menu-panel');

        // ── Cotizador > Catálogos: wiring que antes corría a nivel de módulo
        // (el modal ya existía en el DOM al parsear app.js) -- movido acá porque
        // ahora el modal se inserta recién en mount(), después de que este
        // archivo ya se evaluó por completo.
        document.getElementById('pricing-manage-catalogs-btn')?.addEventListener('click', () => {
            closeAllTopbarDropdowns();
            openPricingCatalogsModal();
        });
        document.getElementById('pricing-catalogs-modal-close')?.addEventListener('click', closePricingCatalogsModal);
        document.getElementById('pricing-catalogs-modal-backdrop')?.addEventListener('click', closePricingCatalogsModal);
        document.querySelectorAll('#pricing-catalogs-tab-switch .option-switch-btn').forEach(btn => {
            btn.addEventListener('click', () => switchPricingCatalogsTab(btn.dataset.value));
        });

        materialAddKindSwitch = createOptionSwitch('material-add-kind-switch', (kind) => {
            updatePricingMaterialUnitOptions(kind);
            const filamentExtra = document.getElementById('material-add-extra-filament');
            const sheetExtra = document.getElementById('material-add-extra-sheet');
            if (filamentExtra) filamentExtra.hidden = kind !== 'filament';
            if (sheetExtra) sheetExtra.hidden = kind !== 'sheet';
        });
        materialAddKindSwitch.setValue('filament');
        updatePricingMaterialUnitOptions('filament');

        document.getElementById('material-add-btn')?.addEventListener('click', submitPricingMaterialForm);
        document.getElementById('material-add-cancel-edit-btn')?.addEventListener('click', resetPricingMaterialForm);

        machineAddKindSwitch = createOptionSwitch('machine-add-kind-switch', () => {});
        machineAddKindSwitch.setValue('printer');

        document.getElementById('machine-add-btn')?.addEventListener('click', submitPricingMachineForm);
        document.getElementById('machine-add-cancel-edit-btn')?.addEventListener('click', resetPricingMachineForm);

        document.getElementById('machine-import-device-select')?.addEventListener('change', (e) => {
            const option = e.target.selectedOptions[0];
            if (!option || !option.dataset.name) return;
            document.getElementById('machine-add-name-input').value = option.dataset.name;
            machineAddKindSwitch.setValue(option.dataset.kind);
        });


        settingsMarginModeSwitch = createOptionSwitch('settings-margin-mode-switch', (mode) => {
            document.getElementById('settings-margin-percentage-field').hidden = mode !== 'percentage';
            document.getElementById('settings-margin-flat-field').hidden = mode !== 'flat_amount';
        });
        settingsMarginModeSwitch.setValue('percentage');

        document.getElementById('settings-save-btn-catalogs')?.addEventListener('click', submitPricingCatalogsSettingsForm);
    }

    function updatePricingBreadcrumbState() {
        const step1 = document.getElementById('pricing-breadcrumb-step-1');
        const step2 = document.getElementById('pricing-breadcrumb-step-2');
        const step3 = document.getElementById('pricing-breadcrumb-step-3');
        const sub1 = document.getElementById('pricing-breadcrumb-sub-1');
        if (!step1 || !step2 || !step3) return;

        const hasFile = !!pricingSelectedFile;
        const hasQuote = !!pricingLastQuoteResult;

        if (sub1) sub1.textContent = hasFile ? 'Archivo seleccionado' : 'Selecciona un archivo';
        step1.classList.toggle('done', hasFile);
        step1.classList.toggle('active', !hasFile);
        step2.classList.toggle('done', hasQuote);
        step2.classList.toggle('active', hasFile && !hasQuote);
        step3.classList.toggle('active', hasQuote);
    }

    function updatePricingJobTypeTheme() {
        const section = document.getElementById('pricing-section');
        if (!section) return;
        section.classList.remove('job-type-laser', 'job-type-cnc');
        if (pricingJobType === 'laser_cut' || pricingJobType === 'laser_engrave') {
            section.classList.add('job-type-laser');
        } else if (pricingJobType === 'cnc') {
            section.classList.add('job-type-cnc');
        }
    }

    function setPricingJobType(type) {
        if (!PRICING_JOB_TYPE_MAP[type] || pricingJobType === type) return;
        pricingJobType = type;
        pricingBrowsePath = '';
        pricingSelectedFile = null;
        pricingLastQuoteResult = null;
        pricingLastSavedQuoteId = null;
        pricingLastLoadedQuoteId = null;
        document.getElementById('pricing-selected-file-block').hidden = true;
        document.getElementById('pricing-file-empty').hidden = false;
        document.getElementById('pricing-file-info-card').hidden = true;
        document.querySelectorAll('#pricing-job-type-switch .option-switch-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.value === type);
        });
        updatePricingJobTypeTheme();
        renderPricingMaterialSelect();
        renderPricingMachineSelect();
        renderSpoolmanField();
        loadPricingFileBrowser('');
        renderPricingCostSummary(null);
        renderPricingFileInfo(null);
        updatePricingBreadcrumbState();
    }

    function showPricingFileBrowserAgain() {
        pricingSelectedFile = null;
        document.getElementById('pricing-selected-file-block').hidden = true;
        document.getElementById('pricing-file-empty').hidden = false;
        renderPricingFileBrowser();
        updatePricingBreadcrumbState();
    }

    function resetPricingWizard() {
        pricingSelectedFile = null;
        pricingLastQuoteResult = null;
        pricingLastSavedQuoteId = null;
        pricingExtraCosts = [];
        pricingQuoteDate = null;
        document.getElementById('pricing-file-empty').hidden = false;
        document.getElementById('pricing-selected-file-block').hidden = true;
        document.getElementById('pricing-file-info-card').hidden = true;
        const qtyInput = document.getElementById('pricing-quantity-input');
        if (qtyInput) qtyInput.value = 1;
        const notesInput = document.getElementById('pricing-notes-input');
        if (notesInput) notesInput.value = '';
        const validUntilInput = document.getElementById('pricing-valid-until-input');
        if (validUntilInput) validUntilInput.value = '';
        const clientNameInput = document.getElementById('pricing-client-name-input');
        if (clientNameInput) clientNameInput.value = '';
        const clientPhoneInput = document.getElementById('pricing-client-phone-input');
        if (clientPhoneInput) clientPhoneInput.value = '';
        ensurePricingValidUntilDefault();
        document.querySelectorAll('#pricing-detail-level-switch .option-switch-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.value === 'standard');
        });
        renderPricingFileBrowser();
        renderPricingExtraCosts();
        renderPricingCostSummary(null);
        renderPricingFileInfo(null);
        renderPricingAdditionalInfo(null);
        updatePricingBreadcrumbState();
        closeAllTopbarDropdowns();
    }

    function copyPricingQuoteId() {
        if (!pricingLastSavedQuoteId) return;
        navigator.clipboard?.writeText(pricingLastSavedQuoteId)
            .then(() => toast('ID copiado'))
            .catch(() => {});
    }

    async function loadPricingCatalogs() {
        try {
            const [materialsRes, machinesRes] = await Promise.all([
                fetch('/api/pricing/materials'),
                fetch('/api/pricing/machines'),
            ]);
            pricingMaterials = materialsRes.ok ? (await materialsRes.json()).materials : [];
            pricingMachines = machinesRes.ok ? (await machinesRes.json()).machines : [];
        } catch (error) {
            console.error(error);
            pricingMaterials = [];
            pricingMachines = [];
        }
        renderPricingMaterialSelect();
        renderPricingMachineSelect();
        await loadSpoolmanStatus();
        renderSpoolmanField();
    }

    // El plugin Materiales (Spoolman) es opcional e independiente -- si no
    // está instalado, /api/spoolman/config ni siquiera existe (404). Si está
    // instalado pero nunca se configuró un servidor, existe pero devuelve
    // configured:false. En ningún caso se inventa un costo: sin datos reales
    // de Spoolman, el selector de carrete se oculta o avisa, y el cotizador
    // sigue funcionando con el catálogo de materiales genéricos de siempre.
    async function loadSpoolmanStatus() {
        try {
            const configRes = await fetch('/api/spoolman/config');
            if (!configRes.ok) {
                spoolmanPluginInstalled = false;
                spoolmanConfigured = false;
                spoolmanSpools = [];
                return;
            }
            spoolmanPluginInstalled = true;
            const config = await configRes.json();
            spoolmanConfigured = !!(config.configured && config.connected);
            if (!spoolmanConfigured) {
                spoolmanSpools = [];
                return;
            }
            const spoolsRes = await fetch('/api/spoolman/spools');
            spoolmanSpools = spoolsRes.ok ? (await spoolsRes.json()).spools : [];
        } catch (error) {
            console.error(error);
            spoolmanPluginInstalled = false;
            spoolmanConfigured = false;
            spoolmanSpools = [];
        }
    }

    function renderSpoolmanField() {
        const field = document.getElementById('pricing-spoolman-field');
        const select = document.getElementById('pricing-spoolman-select');
        const notice = document.getElementById('pricing-spoolman-notice');
        if (!field || !select || !notice) return;

        // Solo tiene sentido para impresión 3D (filamento) -- láser/CNC no
        // consumen carrete.
        const relevant = pricingJobType === 'printer';
        field.hidden = !relevant;
        if (!relevant) return;

        if (!spoolmanPluginInstalled) {
            select.hidden = true;
            notice.hidden = false;
            notice.textContent = 'El consumo real de filamento (colores, tipo y disponibilidad) solo se ve acá si tenés instalado el plugin Materiales (Spoolman). Mientras tanto se usa el costo del material genérico.';
            renderSpoolmanSpoolInfo();
            return;
        }
        if (!spoolmanConfigured) {
            select.hidden = true;
            notice.hidden = false;
            notice.textContent = 'El plugin Materiales (Spoolman) está instalado pero todavía no está conectado a un servidor -- configuralo en Configuración → Plugins → Materiales para ver el inventario real acá.';
            renderSpoolmanSpoolInfo();
            return;
        }

        select.hidden = false;
        notice.hidden = true;

        const prevValue = pricingLinkedSpoolId;
        const options = spoolmanSpools.map(spool => {
            const filament = spool.filament || {};
            const available = Math.round(spool.available_weight ?? spool.remaining_weight ?? 0);
            const label = [filament.material, filament.name].filter(Boolean).join(' ') || 'Carrete';
            return `<option value="${esc(String(spool.id))}">${esc(label)} — ${available} g disponibles</option>`;
        }).join('');
        select.innerHTML = `<option value="">Sin carrete vinculado (usar costo del material genérico)</option>${options}`;
        if (spoolmanSpools.some(s => String(s.id) === prevValue)) {
            select.value = prevValue;
        } else {
            pricingLinkedSpoolId = '';
        }
        renderSpoolmanSpoolInfo();
    }

    function getLinkedSpool() {
        return spoolmanSpools.find(s => String(s.id) === pricingLinkedSpoolId) || null;
    }

    function renderSpoolmanSpoolInfo() {
        const info = document.getElementById('pricing-spoolman-info');
        if (!info) return;
        const spool = getLinkedSpool();
        if (!spool) {
            info.hidden = true;
            info.innerHTML = '';
            return;
        }
        const filament = spool.filament || {};
        const colorHex = filament.color_hex ? `#${filament.color_hex}` : '#9a8258';
        const available = Math.round(spool.available_weight ?? spool.remaining_weight ?? 0);
        info.hidden = false;
        info.innerHTML = `
            <span class="pricing-spoolman-color-dot" style="background:${esc(colorHex)}"></span>
            <span>${esc(filament.material || 'Filamento')}${filament.name ? ' · ' + esc(filament.name) : ''}</span>
            <strong>${available} g disponibles</strong>
        `;
    }

    function renderPricingMaterialSelect() {
        const select = document.getElementById('pricing-material-select');
        if (!select) return;
        const wantKind = PRICING_JOB_TYPE_MAP[pricingJobType].materialKind;
        const relevant = pricingMaterials.filter(m => wantKind ? m.kind === wantKind : m.kind !== 'filament');
        const prevValue = select.value;
        select.innerHTML = relevant.length
            ? relevant.map(m => `<option value="${esc(m.id)}">${esc(m.name)}</option>`).join('')
            : `<option value="">${esc('No hay materiales de este tipo en el catálogo')}</option>`;
        if (relevant.some(m => m.id === prevValue)) select.value = prevValue;
    }

    function renderPricingMachineSelect() {
        const select = document.getElementById('pricing-machine-select');
        if (!select) return;
        const wantKind = PRICING_JOB_TYPE_MAP[pricingJobType].machineKind;
        const relevant = pricingMachines.filter(m => m.kind === wantKind);
        const prevValue = select.value;
        select.innerHTML = `<option value="">${esc('Sin máquina específica')}</option>` +
            relevant.map(m => `<option value="${esc(m.id)}">${esc(m.name)}</option>`).join('');
        if (relevant.some(m => m.id === prevValue)) select.value = prevValue;
    }

    async function loadPricingFileBrowser(path) {
        pricingBrowsePath = path;
        const container = document.getElementById('pricing-file-browser');
        if (container) container.innerHTML = `<div class="empty-state-small">${esc('Cargando...')}</div>`;
        try {
            const response = await fetch(`/api/browse?path=${encodeURIComponent(path)}&type=${encodeURIComponent(pricingSection())}`);
            if (!response.ok) throw new Error('No se pudo cargar la carpeta');
            pricingBrowseData = await response.json();
        } catch (error) {
            console.error(error);
            pricingBrowseData = { folders: [], files: [] };
        }
        renderPricingBreadcrumb();
        renderPricingFileBrowser();
    }

    function renderPricingBreadcrumb() {
        const container = document.getElementById('pricing-file-breadcrumb');
        if (!container) return;
        const rootLabel = pricingSection() === 'model' ? 'Impresión 3D' : 'Láser / CNC';
        const parts = pricingBrowsePath ? pricingBrowsePath.split('/') : [];
        let accPath = '';
        const crumbs = [`<button type="button" data-path="">${esc(rootLabel)}</button>`];
        parts.forEach(part => {
            accPath = accPath ? `${accPath}/${part}` : part;
            crumbs.push('<span>/</span>');
            crumbs.push(`<button type="button" data-path="${esc(accPath)}">${esc(part)}</button>`);
        });
        container.innerHTML = crumbs.join(' ');
        container.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', () => loadPricingFileBrowser(btn.dataset.path));
        });
    }

    function renderPricingFileBrowser() {
        const container = document.getElementById('pricing-file-browser');
        if (!container) return;
        const folders = pricingBrowseData.folders || [];
        const files = pricingBrowseData.files || [];
        if (!folders.length && !files.length) {
            container.innerHTML = `<div class="empty-state-small">${esc('No se encontraron archivos.')}</div>`;
            return;
        }

        const folderRows = folders.map(folder => `
            <button type="button" class="pricing-file-row folder" data-path="${esc(folder.path)}">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                <span>${esc(folder.name)}</span>
                <span class="pricing-file-row-meta">${folder.file_count}</span>
            </button>
        `);
        const fileRows = files.map(file => `
            <button type="button" class="pricing-file-row${pricingSelectedFile && pricingSelectedFile.id === file.id ? ' selected' : ''}" data-id="${esc(file.id)}">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                <span>${esc(file.name)}</span>
                <span class="pricing-file-row-meta">${esc(formatSize(file.size))}</span>
            </button>
        `);

        container.innerHTML = folderRows.join('') + fileRows.join('');
        container.querySelectorAll('.pricing-file-row.folder').forEach(btn => {
            btn.addEventListener('click', () => loadPricingFileBrowser(btn.dataset.path));
        });
        container.querySelectorAll('.pricing-file-row:not(.folder)').forEach(btn => {
            btn.addEventListener('click', () => {
                const file = files.find(f => f.id === btn.dataset.id);
                if (file) selectPricingFile(file);
            });
        });
    }

    function selectPricingFile(file) {
        pricingSelectedFile = file;
        pricingLastQuoteResult = null;
        pricingLastSavedQuoteId = null;
        pricingLastLoadedQuoteId = null;

        const emptyBox = document.getElementById('pricing-file-empty');
        if (emptyBox) emptyBox.hidden = true;
        const block = document.getElementById('pricing-selected-file-block');
        if (block) block.hidden = false;
        const nameEl = document.getElementById('pricing-selected-file-name');
        if (nameEl) nameEl.textContent = file.name;
        const subEl = document.getElementById('pricing-selected-file-sub');
        if (subEl) subEl.textContent = `${(file.extension || '').replace('.', '').toUpperCase()} · ${formatSize(file.size)}`;

        const thumb = document.getElementById('pricing-selected-file-thumb');
        if (thumb) {
            if (isGcodeFile(file) && pricingJobType === 'cnc') {
                // CNC usa su propio parser (ver comentario en
                // renderCncGcodeThumbnail) — el genérico de abajo interpreta mal
                // el S de RPM de husillo como si fuera potencia de láser.
                renderCncGcodeThumbnail(thumb, file.file_url);
            } else if (isGcodeFile(file)) {
                const relPath = stripSectionPrefix(file.id, pricingSection());
                loadRealGcodeThumbnail(thumb, relPath, pricingSection(), file.file_url);
            } else {
                // STL/3MF/OBJ sin laminar — el visor de trayectoria de G-code no
                // sabe leer esto (antes lo intentaba igual y mostraba el texto
                // de relleno "G-code" en un cuadro vacío). Mismo renderer 3D que
                // ya usa la galería de Modelos para esta misma familia de
                // archivos.
                thumb.innerHTML = '';
                renderStandardModelPreview(thumb, file.file_url);
            }
        }
        const replaceBtn = document.getElementById('pricing-replace-file-btn');
        if (replaceBtn) replaceBtn.disabled = false;

        updatePricingBreadcrumbState();
        schedulePricingQuoteRefresh();
    }

    function addPricingExtraCostRow() {
        pricingExtraCosts.push({ label: '', amount: 0, category: 'consumable' });
        renderPricingExtraCosts();
        schedulePricingQuoteRefresh();
    }

    function removePricingExtraCostRow(index) {
        pricingExtraCosts.splice(index, 1);
        renderPricingExtraCosts();
        schedulePricingQuoteRefresh();
    }

    function renderPricingExtraCosts() {
        const container = document.getElementById('pricing-extra-costs-list');
        if (!container) return;
        if (!pricingExtraCosts.length) {
            container.innerHTML = '';
            return;
        }

        container.innerHTML = pricingExtraCosts.map((cost, index) => `
            <div class="pricing-extra-cost-row" data-index="${index}">
                <input type="text" class="pricing-extra-cost-label" placeholder="${esc('Descripción del costo')}" value="${esc(cost.label)}">
                <input type="number" class="pricing-extra-cost-amount" min="0" step="0.01" value="${cost.amount}">
                <select class="pricing-extra-cost-category">
                    <option value="consumable"${cost.category === 'consumable' ? ' selected' : ''}>${esc('Consumible')}</option>
                    <option value="additional"${cost.category === 'additional' ? ' selected' : ''}>${esc('Adicional')}</option>
                </select>
                <button type="button" class="pricing-extra-cost-remove-btn" title="${esc('Quitar')}">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
            </div>
        `).join('');

        container.querySelectorAll('.pricing-extra-cost-row').forEach(row => {
            const index = parseInt(row.dataset.index, 10);
            row.querySelector('.pricing-extra-cost-label').addEventListener('input', (e) => {
                pricingExtraCosts[index].label = e.target.value;
                pricingLastSavedQuoteId = null;
                schedulePricingQuoteRefresh();
            });
            row.querySelector('.pricing-extra-cost-amount').addEventListener('input', (e) => {
                pricingExtraCosts[index].amount = parseFloat(e.target.value) || 0;
                pricingLastSavedQuoteId = null;
                schedulePricingQuoteRefresh();
            });
            row.querySelector('.pricing-extra-cost-category').addEventListener('change', (e) => {
                pricingExtraCosts[index].category = e.target.value;
                pricingLastSavedQuoteId = null;
                schedulePricingQuoteRefresh();
            });
            row.querySelector('.pricing-extra-cost-remove-btn').addEventListener('click', () => removePricingExtraCostRow(index));
        });
    }

    function schedulePricingQuoteRefresh() {
        clearTimeout(pricingQuoteRequestTimer);
        pricingQuoteRequestTimer = setTimeout(refreshPricingQuote, 400);
    }

    async function refreshPricingQuote() {
        if (!pricingSelectedFile) {
            renderPricingCostSummary(null);
            renderPricingFileInfo(null);
            renderPricingAdditionalInfo(null);
            return;
        }
        const materialSelect = document.getElementById('pricing-material-select');
        const materialId = materialSelect ? materialSelect.value : '';
        if (!materialId) {
            renderPricingCostSummary(null);
            return;
        }
        const machineId = document.getElementById('pricing-machine-select')?.value || '';
        const quantity = parseFloat(document.getElementById('pricing-quantity-input')?.value) || 1;
        const relPath = stripSectionPrefix(pricingSelectedFile.id, pricingSection());
        const validExtraCosts = pricingExtraCosts.filter(c => c.label && c.amount);
        const detailLevel = document.querySelector('#pricing-detail-level-switch .option-switch-btn.active')?.dataset.value || 'standard';

        const overrides = { detail_level: detailLevel };
        const linkedSpool = pricingJobType === 'printer' ? getLinkedSpool() : null;
        if (linkedSpool) {
            const filament = linkedSpool.filament || {};
            // Mismo criterio que ya usa spoolman.js: precio/peso a nivel
            // carrete pisan al del tipo de filamento si están definidos.
            const price = linkedSpool.price || filament.price;
            const nominalWeightG = linkedSpool.initial_weight || filament.weight;
            if (price && nominalWeightG) {
                overrides.spoolman_unit_cost_per_g = price / nominalWeightG;
            }
            if (filament.diameter) overrides.spoolman_diameter_mm = filament.diameter;
            if (filament.density) overrides.spoolman_density_g_cm3 = filament.density;
            overrides.spoolman_material_label = [filament.material, filament.name].filter(Boolean).join(' ') || 'Carrete Spoolman';
            const availableG = linkedSpool.available_weight ?? linkedSpool.remaining_weight;
            if (availableG != null) overrides.spoolman_available_g = availableG;
        }

        const formData = new FormData();
        formData.append('path', relPath);
        formData.append('section', pricingSection());
        formData.append('material_id', materialId);
        formData.append('quantity', quantity);
        if (machineId) formData.append('machine_id', machineId);
        formData.append('extra_costs', JSON.stringify(validExtraCosts));
        formData.append('overrides', JSON.stringify(overrides));

        try {
            const response = await fetch('/api/pricing/quote', { method: 'POST', body: formData });
            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.detail || 'No se pudo calcular la cotización.');
            }
            const result = await response.json();
            pricingLastQuoteResult = result;
            pricingLastSavedQuoteId = null;
            pricingQuoteDate = new Date();
            renderPricingCostSummary(result);
            renderPricingFileInfo(result);
            renderPricingAdditionalInfo(result);
            updatePricingBreadcrumbState();
        } catch (error) {
            console.error(error);
            pricingLastQuoteResult = null;
            renderPricingCostSummary(null, error.message);
            updatePricingBreadcrumbState();
        }
    }

    function renderPricingCostSummary(result, errorMessage) {
        const linesContainer = document.getElementById('pricing-cost-lines');
        const subtotalRow = document.getElementById('pricing-cost-subtotal-row');
        const marginRow = document.getElementById('pricing-cost-margin-row');
        const totalRow = document.getElementById('pricing-cost-total-row');
        const saveBtn = document.getElementById('pricing-save-btn');
        if (!linesContainer) return;

        if (!result) {
            linesContainer.innerHTML = `<div class="empty-state-small">${errorMessage ? esc(errorMessage) : esc('Selecciona un archivo y un material para ver el costo.')}</div>`;
            if (subtotalRow) subtotalRow.hidden = true;
            if (marginRow) marginRow.hidden = true;
            if (totalRow) totalRow.hidden = true;
            if (saveBtn) saveBtn.disabled = true;
            updatePricingSaveGatedButtons();
            return;
        }

        // El selector de moneda/tipo de cambio es solo de presentación: multiplica
        // lo que ya calculó el backend para mostrarlo en otra moneda, pero NUNCA
        // se manda al guardar — la cotización persistida siempre queda en la
        // moneda base (result.costs.currency), para no inventar una tasa de
        // conversión que nadie confirmó.
        const baseCurrency = result.costs.currency;
        const displayCurrency = document.getElementById('pricing-currency-select')?.value || baseCurrency;
        const rate = parseFloat(document.getElementById('pricing-exchange-rate-input')?.value) || 1;
        const fmt = (amount) => `${displayCurrency} ${(amount * rate).toFixed(2)}`;

        linesContainer.innerHTML = result.cost_lines.map((line, index) => {
            const localizedLabel = PRICING_COST_LINE_LABELS[line.key] || line.label;
            let localizedDetail = line.detail;
            if (line.key === 'machine_usage' && result.machine && result.extracted?.estimated_time_minutes != null) {
                const rate = String(line.detail || '').match(/\$([\d.,]+)/)?.[1] || '0';
                localizedDetail = '{time} a ${rate}/h'
                    .replace('{time}', _formatMinutes(result.extracted.estimated_time_minutes))
                    .replace('{rate}', rate);
            } else if (line.key === 'labor') {
                const minutes = String(line.detail || '').match(/[\d.,]+/)?.[0] || '0';
                localizedDetail = 'Preparación y supervisión ({minutes} min)'.replace('{minutes}', minutes);
            }
            return `
            <div class="pricing-cost-line">
                <span class="pricing-cost-line-icon icon-${line.key}">${index + 1}</span>
                <span class="pricing-cost-line-body">
                    <span>
                        <span class="pricing-cost-line-label">${esc(localizedLabel)}</span>
                        ${localizedDetail ? `<span class="pricing-cost-line-detail">${esc(localizedDetail)}</span>` : ''}
                    </span>
                    <span class="pricing-cost-line-amount${line.missing ? ' missing' : ''}">${line.missing ? '—' : fmt(line.amount)}</span>
                </span>
            </div>
        `; }).join('') + (result.warnings || []).map(warning => `
            <div class="pricing-cost-warning">${esc(warning)}</div>
        `).join('');

        const subtotalAmountEl = document.getElementById('pricing-cost-subtotal-amount');
        if (subtotalAmountEl) subtotalAmountEl.textContent = fmt(result.costs.subtotal);
        const marginPillEl = document.getElementById('pricing-margin-pill');
        if (marginPillEl) marginPillEl.textContent = result.costs.margin_percentage != null ? `${result.costs.margin_percentage}%` : '';
        const marginAmountEl = document.getElementById('pricing-cost-margin-amount');
        if (marginAmountEl) marginAmountEl.textContent = fmt(result.costs.margin_cost);
        const totalAmountEl = document.getElementById('pricing-cost-total-amount');
        if (totalAmountEl) totalAmountEl.textContent = `${fmt(result.costs.total)}${result.costs.total_is_partial ? ' *' : ''}`;

        if (subtotalRow) subtotalRow.hidden = false;
        if (marginRow) marginRow.hidden = false;
        if (totalRow) totalRow.hidden = false;
        if (saveBtn) saveBtn.disabled = false;
        updatePricingSaveGatedButtons();
    }

    // Vista previa PDF / Enviar cotización solo tienen sentido sobre una
    // cotización YA GUARDADA (necesitan un id real para /cotizador/print/{id}
    // y /api/pricing/quotes/{id}/status) — se habilitan recién después de
    // "Guardar cotización", con un tooltip explicando por qué mientras tanto.
    function updatePricingSaveGatedButtons() {
        const printBtn = document.getElementById('pricing-print-btn');
        const sendBtn = document.getElementById('pricing-send-btn');
        const whatsappBtn = document.getElementById('pricing-whatsapp-btn');
        const enabled = !!pricingLastSavedQuoteId;
        [printBtn, sendBtn, whatsappBtn].forEach(btn => {
            if (!btn) return;
            btn.disabled = !enabled;
            btn.title = enabled ? '' : 'Guarda la cotización primero';
        });
    }

    function renderPricingFileInfo(result) {
        const card = document.getElementById('pricing-file-info-card');
        const list = document.getElementById('pricing-file-info-list');
        const dimsEl = document.getElementById('pricing-selected-file-dims');
        if (!card || !list) return;
        if (!result) {
            card.hidden = true;
            if (dimsEl) dimsEl.hidden = true;
            return;
        }
        const e = result.extracted;
        const rows = [['Tipo de trabajo', pricingJobTypeLabel(pricingJobType), 'pill']];
        if (e.estimated_time_minutes != null) rows.push(['Tiempo estimado', _formatMinutes(e.estimated_time_minutes)]);
        if (e.filament_g != null) rows.push(['Peso estimado', `${e.filament_g.toFixed(2)} g`]);
        if (e.cut_length_mm != null) rows.push(['Largo de corte', `${(e.cut_length_mm / 1000).toFixed(2)} m`]);
        if (e.bounding_box_area_m2 != null) rows.push(['Área', `${e.bounding_box_area_m2.toFixed(3)} m²`]);

        list.innerHTML = rows.map(([label, value, kind]) => `
            <div class="pricing-info-row">
                <span>${esc(label)}</span>
                ${kind === 'pill' ? `<span class="device-status-pill on">${esc(value)}</span>` : `<strong>${esc(value)}</strong>`}
            </div>
        `).join('');
        card.hidden = false;

        // Ancho/Alto: solo si el bounding box real vino de G-code parseado (no
        // hay forma honesta de saberlo para un STL/3MF sin laminar todavía).
        if (dimsEl) {
            if (e.width_mm != null && e.height_mm != null) {
                dimsEl.innerHTML = `
                    <span>${esc('Ancho:')} <strong>${e.width_mm.toFixed(1)} mm</strong></span>
                    <span>${esc('Alto:')} <strong>${e.height_mm.toFixed(1)} mm</strong></span>
                `;
                dimsEl.hidden = false;
            } else {
                dimsEl.hidden = true;
            }
        }
    }

    function renderPricingAdditionalInfo(result) {
        const totalTimeEl = document.getElementById('pricing-info-total-time');
        const dateEl = document.getElementById('pricing-info-quote-date');
        const idEl = document.getElementById('pricing-info-quote-id');
        const copyBtn = document.getElementById('pricing-copy-id-btn');

        if (totalTimeEl) totalTimeEl.textContent = result && result.total_time_minutes != null ? _formatMinutes(result.total_time_minutes) : '—';
        if (dateEl) dateEl.textContent = pricingQuoteDate ? pricingQuoteDate.toLocaleString() : '—';
        if (idEl) idEl.textContent = pricingLastSavedQuoteId || '—';
        if (copyBtn) copyBtn.hidden = !pricingLastSavedQuoteId;
    }

    async function savePricingQuote() {
        if (!pricingLastQuoteResult) return;
        const saveBtn = document.getElementById('pricing-save-btn');
        if (saveBtn) saveBtn.disabled = true;
        try {
            const detailLevel = document.querySelector('#pricing-detail-level-switch .option-switch-btn.active')?.dataset.value || 'standard';
            const quotePayload = {
                ...pricingLastQuoteResult,
                job_type: pricingJobType,
                color: document.getElementById('pricing-color-select')?.value || null,
                detail_level: detailLevel,
                valid_until: document.getElementById('pricing-valid-until-input')?.value || null,
                notes: document.getElementById('pricing-notes-input')?.value.trim() || null,
                client_name: document.getElementById('pricing-client-name-input')?.value.trim() || null,
                client_phone: document.getElementById('pricing-client-phone-input')?.value.trim() || null,
            };
            const currentQuoteId = pricingLastLoadedQuoteId || pricingLastSavedQuoteId;
            const url = currentQuoteId ? `/api/pricing/quotes/${encodeURIComponent(currentQuoteId)}` : '/api/pricing/quotes';
            const method = currentQuoteId ? 'PUT' : 'POST';
            const formData = new FormData();
            formData.append('quote', JSON.stringify(quotePayload));
            const response = await fetch(url, { method, body: formData });
            if (!response.ok) throw new Error('No se pudo guardar la cotización.');
            const saved = await response.json();
            pricingLastSavedQuoteId = saved.id;
            pricingLastLoadedQuoteId = saved.id;
            toast(`${'Cotización guardada'}: ${saved.id}`);
            updatePricingSaveGatedButtons();
            renderPricingAdditionalInfo(pricingLastQuoteResult);
            loadPricingQuotesHistory();
        } catch (error) {
            console.error(error);
            alertDialog(error.message || 'No se pudo guardar la cotización.', '', 'danger');
        } finally {
            if (saveBtn) saveBtn.disabled = false;
        }
    }

    function openPricingPrintPreview(quoteId) {
        const id = quoteId || pricingLastSavedQuoteId;
        if (!id) return;
        window.open(`/api/pricing/quotes/${encodeURIComponent(id)}/pdf`, '_blank');
    }

    // Dispara la descarga de un archivo sin navegar la pestaña actual — un
    // <a download> temporal en vez de window.open, que en algunos navegadores
    // solo previsualiza el PDF en vez de bajarlo (acá si o si tiene que quedar
    // un archivo en Descargas para poder adjuntarlo a mano en WhatsApp).
    function triggerFileDownload(url) {
        const link = document.createElement('a');
        link.href = url;
        link.download = '';
        document.body.appendChild(link);
        link.click();
        link.remove();
    }

    async function sendPricingQuoteAction(quoteId) {
        const id = quoteId || pricingLastSavedQuoteId;
        if (!id) return;
        try {
            const formData = new FormData();
            formData.append('status', 'sent');
            const response = await fetch(`/api/pricing/quotes/${encodeURIComponent(id)}/status`, { method: 'POST', body: formData });
            if (!response.ok) throw new Error('No se pudo actualizar el estado de la cotización.');
            toast('Cotización marcada como enviada');
            loadPricingQuotesHistory();
        } catch (error) {
            console.error(error);
            alertDialog(error.message || 'No se pudo actualizar el estado de la cotización.', '', 'danger');
        }
    }

    async function openPricingWhatsappModal(quoteId) {
        const id = quoteId || pricingLastSavedQuoteId;
        if (!id) return;
        try {
            const response = await fetch(`/api/pricing/quotes/${encodeURIComponent(id)}/whatsapp-link`);
            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.detail || 'No se pudo generar el link de WhatsApp.');
            }
            const data = await response.json();
            pricingWhatsappQuoteId = id;
            const textarea = document.getElementById('pricing-whatsapp-message-input');
            if (textarea) textarea.value = data.message || '';
            const modal = document.getElementById('pricing-whatsapp-modal');
            if (modal) modal.classList.add('active');
            if (textarea) textarea.focus();
        } catch (error) {
            console.error(error);
            alertDialog(error.message || 'No se pudo generar el link de WhatsApp.', '', 'danger');
        }
    }

    function closePricingWhatsappModal() {
        const modal = document.getElementById('pricing-whatsapp-modal');
        if (modal) modal.classList.remove('active');
        pricingWhatsappQuoteId = null;
    }

    async function confirmPricingWhatsappSend() {
        const id = pricingWhatsappQuoteId;
        if (!id) return;
        const textarea = document.getElementById('pricing-whatsapp-message-input');
        const message = textarea ? textarea.value : '';
        try {
            const response = await fetch(`/api/pricing/quotes/${encodeURIComponent(id)}/whatsapp-link?message=${encodeURIComponent(message)}`);
            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.detail || 'No se pudo generar el link de WhatsApp.');
            }
            const data = await response.json();
            closePricingWhatsappModal();
            // WhatsApp (wa.me) solo permite prellenar texto, no adjuntar un
            // archivo automáticamente — así que se baja el PDF real primero y
            // se abre WhatsApp después, para que el usuario lo arrastre al
            // chat que ya está esperando con el mensaje listo.
            triggerFileDownload(`/api/pricing/quotes/${encodeURIComponent(id)}/pdf?download=true`);
            window.open(data.url, '_blank');
        } catch (error) {
            console.error(error);
            alertDialog(error.message || 'No se pudo generar el link de WhatsApp.', '', 'danger');
        }
    }

    async function loadPricingQuotesHistory() {
        try {
            const response = await fetch('/api/pricing/quotes');
            if (!response.ok) throw new Error('No se pudo cargar el historial');
            const data = await response.json();
            renderPricingQuotesTable(data.quotes || []);
        } catch (error) {
            console.error(error);
            renderPricingQuotesTable([]);
        }
    }

    function renderPricingQuotesTable(quotes) {
        const tbody = document.getElementById('pricing-quotes-tbody');
        if (!tbody) return;
        if (!quotes.length) {
            tbody.innerHTML = `<tr><td colspan="7" class="empty-state">${esc('Todavía no hay cotizaciones guardadas.')}</td></tr>`;
            return;
        }

        tbody.innerHTML = quotes.map(quote => {
            const date = quote.created_at ? new Date(quote.created_at * 1000).toLocaleString() : '—';
            const total = quote.costs ? `${quote.costs.currency} ${quote.costs.total.toFixed(2)}` : '—';
            const status = quote.status || 'draft';
            const statusLabel = PRICING_STATUS_LABELS[status] || status;
            const jobTypeLabel = quote.job_type ? pricingJobTypeLabel(quote.job_type) : '—';
            return `
                <tr>
                    <td>${esc(quote.id)}</td>
                    <td class="pricing-quote-file-cell">
                        <span class="pricing-quote-file-name">${esc(quote.file?.name || '—')}</span>
                        <span class="pricing-quote-material-name">${esc(quote.material?.name || '')}</span>
                    </td>
                    <td>${esc(jobTypeLabel)}</td>
                    <td>${esc(total)}</td>
                    <td>${esc(date)}</td>
                    <td><span class="device-status-pill ${esc(status)}">${esc(statusLabel)}</span></td>
                    <td class="pricing-quote-row-actions">
                        <button type="button" class="pricing-quote-print-btn" data-id="${esc(quote.id)}" title="${esc('Vista previa PDF')}">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                        </button>
                        <button type="button" class="pricing-quote-load-btn" data-id="${esc(quote.id)}" title="${esc('Cargar cotización')}">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 17l5-5-5-5"/><path d="M5 12h14"/></svg>
                        </button>
                        <button type="button" class="pricing-quote-delete-btn" data-id="${esc(quote.id)}" title="${esc('Eliminar cotización')}">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        tbody.querySelectorAll('.pricing-quote-print-btn').forEach(btn => {
            btn.addEventListener('click', () => openPricingPrintPreview(btn.dataset.id));
        });
        tbody.querySelectorAll('.pricing-quote-load-btn').forEach(btn => {
            btn.addEventListener('click', () => loadPricingQuote(btn.dataset.id));
        });
        tbody.querySelectorAll('.pricing-quote-delete-btn').forEach(btn => {
            btn.addEventListener('click', () => deletePricingQuote(btn.dataset.id));
        });
    }

    async function loadPricingQuote(quoteId) {
        if (!quoteId) return;
        try {
            const response = await fetch(`/api/pricing/quotes/${encodeURIComponent(quoteId)}`);
            if (!response.ok) throw new Error('No se pudo cargar la cotización.');
            const quote = await response.json();
            fillPricingQuoteWizard(quote);
            toast(`${'Cotización cargada'}: ${quote.id}`);
        } catch (error) {
            console.error(error);
            alertDialog(error.message || 'No se pudo cargar la cotización.', '', 'danger');
        }
    }

    function fillPricingQuoteWizard(quote) {
        if (!quote || !quote.file) return;
        const jobType = quote.job_type || 'printer';
        setPricingJobType(jobType);
        pricingLastLoadedQuoteId = quote.id;
        pricingLastSavedQuoteId = quote.id;
        pricingQuoteDate = quote.created_at ? new Date(quote.created_at * 1000) : new Date();

        const fileSection = quote.file.section === 'gcode' ? 'gcode' : 'model';
        const sectionPrefix = fileSection === 'gcode' ? 'gcode' : 'models';
        const relPath = quote.file.path || quote.file.name || '';
        const fakeFile = {
            id: `${sectionPrefix}/${relPath}`,
            name: quote.file.name || relPath.split('/').pop(),
            extension: `.${(quote.file.name || relPath).split('.').pop()}`,
            size: 0,
            file_url: `/uploads/${sectionPrefix}/${relPath}`,
        };
        pricingSelectedFile = fakeFile;
        const emptyBox = document.getElementById('pricing-file-empty');
        const block = document.getElementById('pricing-selected-file-block');
        if (emptyBox) emptyBox.hidden = true;
        if (block) block.hidden = false;
        const nameEl = document.getElementById('pricing-selected-file-name');
        if (nameEl) nameEl.textContent = fakeFile.name;
        const subEl = document.getElementById('pricing-selected-file-sub');
        if (subEl) subEl.textContent = `${(fakeFile.extension || '').replace('.', '').toUpperCase()} · ${fakeFile.size ? formatSize(fakeFile.size) : '—'}`;
        const replaceBtn = document.getElementById('pricing-replace-file-btn');
        if (replaceBtn) replaceBtn.disabled = true;

        document.getElementById('pricing-color-select').value = quote.color || '';
        const qtyInput = document.getElementById('pricing-quantity-input');
        if (qtyInput) qtyInput.value = quote.quantity || 1;
        document.querySelectorAll('#pricing-detail-level-switch .option-switch-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.value === (quote.detail_level || 'standard'));
        });
        const notesInput = document.getElementById('pricing-notes-input');
        if (notesInput) notesInput.value = quote.notes || '';
        const clientNameInput = document.getElementById('pricing-client-name-input');
        if (clientNameInput) clientNameInput.value = quote.client_name || '';
        const clientPhoneInput = document.getElementById('pricing-client-phone-input');
        if (clientPhoneInput) clientPhoneInput.value = quote.client_phone || '';
        const validUntilInput = document.getElementById('pricing-valid-until-input');
        if (validUntilInput) validUntilInput.value = quote.valid_until || '';

        pricingExtraCosts = [];
        renderPricingExtraCosts();

        const materialSelect = document.getElementById('pricing-material-select');
        if (materialSelect && quote.material?.id) {
            materialSelect.value = quote.material.id;
        }
        const machineSelect = document.getElementById('pricing-machine-select');
        if (machineSelect && quote.machine?.id) {
            machineSelect.value = quote.machine.id;
        }

        pricingLastQuoteResult = quote;
        renderPricingCostSummary(quote);
        renderPricingFileInfo(quote);
        renderPricingAdditionalInfo(quote);
        updatePricingBreadcrumbState();
    }

    async function deletePricingQuote(quoteId) {
        if (!quoteId || !window.confirm('¿Eliminar esta cotización?')) return;
        try {
            const response = await fetch(`/api/pricing/quotes/${encodeURIComponent(quoteId)}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('No se pudo eliminar la cotización.');
            toast('Cotización eliminada.');
            if (pricingLastLoadedQuoteId === quoteId) {
                pricingLastLoadedQuoteId = null;
                pricingLastSavedQuoteId = null;
                pricingLastQuoteResult = null;
                pricingQuoteDate = null;
                renderPricingAdditionalInfo(null);
                renderPricingCostSummary(null);
            }
            loadPricingQuotesHistory();
        } catch (error) {
            console.error(error);
            alertDialog(error.message || 'No se pudo eliminar la cotización.', '', 'danger');
        }
    }

    // ── Cotizador > Catálogos (materiales/máquinas/ajustes) ──

    let pricingMaterialEditingId = null;
    let pricingMachineEditingId = null;

    function openPricingCatalogsModal() {
        switchPricingCatalogsTab('materials');
        resetPricingMaterialForm();
        resetPricingMachineForm();
        loadPricingMaterialsCatalog();
        loadPricingMachinesCatalog();
        loadPricingMachineImportOptions();
        loadPricingCatalogsSettingsForm();
        document.getElementById('pricing-catalogs-modal')?.classList.add('active');
    }

    function closePricingCatalogsModal() {
        document.getElementById('pricing-catalogs-modal')?.classList.remove('active');
    }

    function switchPricingCatalogsTab(tab) {
        document.querySelectorAll('#pricing-catalogs-tab-switch .option-switch-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.value === tab);
        });
        document.querySelectorAll('.pricing-catalogs-tab').forEach(panel => {
            panel.hidden = panel.id !== `pricing-catalogs-tab-${tab}`;
        });
    }


    // ── Materiales ──

    function pricingMaterialKindLabel(kind) {
        if (kind === 'filament') return 'Filamento';
        if (kind === 'sheet') return 'Lámina';
        return 'Consumible';
    }

    function updatePricingMaterialUnitOptions(kind) {
        const select = document.getElementById('material-add-unit-select');
        if (!select) return;
        const prevValue = select.value;
        if (kind === 'filament') {
            select.innerHTML = '<option value="kg">kg</option><option value="g">g</option>';
            select.disabled = false;
        } else if (kind === 'sheet') {
            select.innerHTML = '<option value="m2">m2</option>';
            select.disabled = true;
        } else {
            select.innerHTML = '<option value="pieza">pieza</option><option value="servicio">servicio</option><option value="unidad">unidad</option>';
            select.disabled = false;
        }
        if (Array.from(select.options).some(o => o.value === prevValue)) select.value = prevValue;
    }


    function resetPricingMaterialForm() {
        pricingMaterialEditingId = null;
        const nameInput = document.getElementById('material-add-name-input');
        if (nameInput) nameInput.value = '';
        const unitCostInput = document.getElementById('material-add-unit-cost-input');
        if (unitCostInput) unitCostInput.value = '';
        const densityInput = document.getElementById('material-add-density-input');
        if (densityInput) densityInput.value = '1.24';
        const diameterInput = document.getElementById('material-add-diameter-input');
        if (diameterInput) diameterInput.value = '1.75';
        const thicknessInput = document.getElementById('material-add-thickness-input');
        if (thicknessInput) thicknessInput.value = '';
        materialAddKindSwitch.setValue('filament');
        updatePricingMaterialUnitOptions('filament');
        const filamentExtra = document.getElementById('material-add-extra-filament');
        if (filamentExtra) filamentExtra.hidden = false;
        const sheetExtra = document.getElementById('material-add-extra-sheet');
        if (sheetExtra) sheetExtra.hidden = true;
        const errorEl = document.getElementById('material-add-error');
        if (errorEl) errorEl.hidden = true;
        const addBtn = document.getElementById('material-add-btn');
        if (addBtn) addBtn.querySelector('span').textContent = 'Agregar material';
        const cancelBtn = document.getElementById('material-add-cancel-edit-btn');
        if (cancelBtn) cancelBtn.hidden = true;
    }

    function fillPricingMaterialForm(material) {
        pricingMaterialEditingId = material.id;
        document.getElementById('material-add-name-input').value = material.name;
        materialAddKindSwitch.setValue(material.kind);
        updatePricingMaterialUnitOptions(material.kind);
        document.getElementById('material-add-extra-filament').hidden = material.kind !== 'filament';
        document.getElementById('material-add-extra-sheet').hidden = material.kind !== 'sheet';
        document.getElementById('material-add-unit-cost-input').value = material.unit_cost;
        const unitSelect = document.getElementById('material-add-unit-select');
        if (unitSelect && material.unit && Array.from(unitSelect.options).some(o => o.value === material.unit)) {
            unitSelect.value = material.unit;
        }
        if (material.kind === 'filament') {
            document.getElementById('material-add-density-input').value = material.density_g_cm3 ?? 1.24;
            document.getElementById('material-add-diameter-input').value = material.diameter_mm ?? 1.75;
        } else if (material.kind === 'sheet') {
            document.getElementById('material-add-thickness-input').value = material.thickness_mm ?? '';
        }
        const addBtn = document.getElementById('material-add-btn');
        if (addBtn) addBtn.querySelector('span').textContent = 'Guardar cambios';
        const cancelBtn = document.getElementById('material-add-cancel-edit-btn');
        if (cancelBtn) cancelBtn.hidden = false;
    }

    async function loadPricingMaterialsCatalog() {
        try {
            const response = await fetch('/api/pricing/materials');
            if (!response.ok) throw new Error();
            const data = await response.json();
            renderPricingMaterialsCatalogList(data.materials || []);
        } catch (error) {
            console.error(error);
            renderPricingMaterialsCatalogList([]);
        }
    }

    function renderPricingMaterialsCatalogList(materials) {
        const container = document.getElementById('pricing-materials-catalog-list');
        if (!container) return;
        if (!materials.length) {
            container.innerHTML = `<div class="empty-state-small">${esc('Todavía no hay materiales en el catálogo.')}</div>`;
            return;
        }
        container.innerHTML = materials.map(material => `
            <div class="usb-port-item" data-id="${esc(material.id)}">
                <div class="usb-port-item-info">
                    <strong>${esc(material.name)}</strong>
                    <span>${esc(pricingMaterialKindLabel(material.kind))} · ${material.unit_cost}/${esc(material.unit || '')}</span>
                </div>
                <div class="pricing-catalog-item-actions">
                    <button type="button" class="theme-option-icon-btn material-edit-btn" data-id="${esc(material.id)}" title="${esc('Editar material')}">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                    </button>
                    <button type="button" class="theme-option-icon-btn theme-option-icon-btn-danger material-remove-btn" data-id="${esc(material.id)}" title="${esc('Eliminar material')}">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>
            </div>
        `).join('');

        container.querySelectorAll('.material-edit-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const material = materials.find(m => m.id === btn.dataset.id);
                if (material) fillPricingMaterialForm(material);
            });
        });
        container.querySelectorAll('.material-remove-btn').forEach(btn => {
            btn.addEventListener('click', () => removePricingMaterialCatalogEntry(btn.dataset.id));
        });
    }

    async function submitPricingMaterialForm() {
        const name = document.getElementById('material-add-name-input')?.value.trim() || '';
        const kind = materialAddKindSwitch.getValue() || 'filament';
        const unitCost = parseFloat(document.getElementById('material-add-unit-cost-input')?.value);
        const unit = document.getElementById('material-add-unit-select')?.value || '';
        const errorEl = document.getElementById('material-add-error');
        if (errorEl) errorEl.hidden = true;

        if (!name || isNaN(unitCost)) {
            if (errorEl) {
                errorEl.textContent = 'Completa nombre y costo unitario';
                errorEl.hidden = false;
            }
            return;
        }

        let config = {};
        if (kind === 'filament') {
            config = {
                density_g_cm3: parseFloat(document.getElementById('material-add-density-input')?.value) || 1.24,
                diameter_mm: parseFloat(document.getElementById('material-add-diameter-input')?.value) || 1.75,
            };
        } else if (kind === 'sheet') {
            const thickness = parseFloat(document.getElementById('material-add-thickness-input')?.value);
            if (!isNaN(thickness)) config = { thickness_mm: thickness };
        }

        try {
            const formData = new FormData();
            formData.append('name', name);
            formData.append('kind', kind);
            formData.append('unit_cost', unitCost);
            formData.append('unit', unit);
            formData.append('config', JSON.stringify(config));
            if (pricingMaterialEditingId) formData.append('id', pricingMaterialEditingId);

            const response = await fetch('/api/pricing/materials', { method: 'POST', body: formData });
            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.detail || 'No se pudo guardar el material');
            }
            toast(pricingMaterialEditingId ? 'Material actualizado' : 'Material agregado');
            resetPricingMaterialForm();
            loadPricingMaterialsCatalog();
            loadPricingCatalogs();
        } catch (error) {
            console.error(error);
            if (errorEl) {
                errorEl.textContent = error.message || 'No se pudo guardar el material';
                errorEl.hidden = false;
            }
        }
    }

    async function removePricingMaterialCatalogEntry(id) {
        if (!(await confirmDialog('¿Eliminar este material del catálogo?', 'Eliminar material'))) return;
        try {
            const formData = new FormData();
            formData.append('id', id);
            const response = await fetch('/api/pricing/materials/remove', { method: 'POST', body: formData });
            if (!response.ok) throw new Error();
            if (pricingMaterialEditingId === id) resetPricingMaterialForm();
            loadPricingMaterialsCatalog();
            loadPricingCatalogs();
        } catch (error) {
            console.error(error);
            alertDialog('No se pudo guardar el material', '', 'danger');
        }
    }


    // ── Máquinas ──


    function pricingMachineKindLabel(kind) {
        if (kind === 'printer') return 'Impresora';
        if (kind === 'laser') return 'Láser';
        return 'CNC';
    }

    function resetPricingMachineForm() {
        pricingMachineEditingId = null;
        const nameInput = document.getElementById('machine-add-name-input');
        if (nameInput) nameInput.value = '';
        const wattsInput = document.getElementById('machine-add-watts-input');
        if (wattsInput) wattsInput.value = '';
        const rateInput = document.getElementById('machine-add-rate-input');
        if (rateInput) rateInput.value = '';
        machineAddKindSwitch.setValue('printer');
        const errorEl = document.getElementById('machine-add-error');
        if (errorEl) errorEl.hidden = true;
        const addBtn = document.getElementById('machine-add-btn');
        if (addBtn) addBtn.querySelector('span').textContent = 'Agregar máquina';
        const cancelBtn = document.getElementById('machine-add-cancel-edit-btn');
        if (cancelBtn) cancelBtn.hidden = true;
        const importSelect = document.getElementById('machine-import-device-select');
        if (importSelect) importSelect.selectedIndex = 0;
    }

    function fillPricingMachineForm(machine) {
        pricingMachineEditingId = machine.id;
        document.getElementById('machine-add-name-input').value = machine.name;
        machineAddKindSwitch.setValue(machine.kind);
        document.getElementById('machine-add-watts-input').value = machine.watts;
        document.getElementById('machine-add-rate-input').value = machine.rate_per_hour;
        const addBtn = document.getElementById('machine-add-btn');
        if (addBtn) addBtn.querySelector('span').textContent = 'Guardar cambios';
        const cancelBtn = document.getElementById('machine-add-cancel-edit-btn');
        if (cancelBtn) cancelBtn.hidden = false;
    }

    async function loadPricingMachinesCatalog() {
        try {
            const response = await fetch('/api/pricing/machines');
            if (!response.ok) throw new Error();
            const data = await response.json();
            renderPricingMachinesCatalogList(data.machines || []);
        } catch (error) {
            console.error(error);
            renderPricingMachinesCatalogList([]);
        }
    }

    function renderPricingMachinesCatalogList(machines) {
        const container = document.getElementById('pricing-machines-catalog-list');
        if (!container) return;
        if (!machines.length) {
            container.innerHTML = `<div class="empty-state-small">${esc('Todavía no hay máquinas en el catálogo.')}</div>`;
            return;
        }
        container.innerHTML = machines.map(machine => `
            <div class="usb-port-item" data-id="${esc(machine.id)}">
                <div class="usb-port-item-info">
                    <strong>${esc(machine.name)}</strong>
                    <span>${esc(pricingMachineKindLabel(machine.kind))} · ${machine.watts}W · $${machine.rate_per_hour}/h</span>
                </div>
                <div class="pricing-catalog-item-actions">
                    <button type="button" class="theme-option-icon-btn machine-edit-btn" data-id="${esc(machine.id)}" title="${esc('Editar máquina')}">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                    </button>
                    <button type="button" class="theme-option-icon-btn theme-option-icon-btn-danger machine-remove-btn" data-id="${esc(machine.id)}" title="${esc('Eliminar máquina')}">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>
            </div>
        `).join('');

        container.querySelectorAll('.machine-edit-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const machine = machines.find(m => m.id === btn.dataset.id);
                if (machine) fillPricingMachineForm(machine);
            });
        });
        container.querySelectorAll('.machine-remove-btn').forEach(btn => {
            btn.addEventListener('click', () => removePricingMachineCatalogEntry(btn.dataset.id));
        });
    }

    async function submitPricingMachineForm() {
        const name = document.getElementById('machine-add-name-input')?.value.trim() || '';
        const kind = machineAddKindSwitch.getValue() || 'printer';
        const watts = parseFloat(document.getElementById('machine-add-watts-input')?.value);
        const ratePerHour = parseFloat(document.getElementById('machine-add-rate-input')?.value);
        const errorEl = document.getElementById('machine-add-error');
        if (errorEl) errorEl.hidden = true;

        if (!name || isNaN(watts) || isNaN(ratePerHour)) {
            if (errorEl) {
                errorEl.textContent = 'Completa nombre, watts y tarifa';
                errorEl.hidden = false;
            }
            return;
        }

        try {
            const formData = new FormData();
            formData.append('name', name);
            formData.append('kind', kind);
            formData.append('watts', watts);
            formData.append('rate_per_hour', ratePerHour);
            if (pricingMachineEditingId) formData.append('id', pricingMachineEditingId);

            const response = await fetch('/api/pricing/machines', { method: 'POST', body: formData });
            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.detail || 'No se pudo guardar la máquina');
            }
            toast(pricingMachineEditingId ? 'Máquina actualizada' : 'Máquina agregada');
            resetPricingMachineForm();
            loadPricingMachinesCatalog();
            loadPricingCatalogs();
        } catch (error) {
            console.error(error);
            if (errorEl) {
                errorEl.textContent = error.message || 'No se pudo guardar la máquina';
                errorEl.hidden = false;
            }
        }
    }

    async function removePricingMachineCatalogEntry(id) {
        if (!(await confirmDialog('¿Eliminar esta máquina del catálogo?', 'Eliminar máquina'))) return;
        try {
            const formData = new FormData();
            formData.append('id', id);
            const response = await fetch('/api/pricing/machines/remove', { method: 'POST', body: formData });
            if (!response.ok) throw new Error();
            if (pricingMachineEditingId === id) resetPricingMachineForm();
            loadPricingMachinesCatalog();
            loadPricingCatalogs();
        } catch (error) {
            console.error(error);
            alertDialog('No se pudo guardar la máquina', '', 'danger');
        }
    }


    async function loadPricingMachineImportOptions() {
        const select = document.getElementById('machine-import-device-select');
        if (!select) return;
        let devices = [];
        try {
            const [printersRes, lasersRes] = await Promise.all([
                fetch('/api/printers'),
                fetch('/api/laser/registry'),
            ]);
            const printers = printersRes.ok ? (await printersRes.json()).printers || [] : [];
            const registryDevices = lasersRes.ok ? (await lasersRes.json()).lasers || [] : [];
            devices = [
                ...printers.map(p => ({ name: p.name, kind: 'printer' })),
                ...registryDevices.map(d => ({ name: d.name, kind: d.kind === 'cnc' ? 'cnc' : 'laser' })),
            ];
        } catch (error) {
            console.error(error);
        }

        if (!devices.length) {
            select.innerHTML = `<option value="" disabled selected>${esc('No se encontraron dispositivos registrados')}</option>`;
            return;
        }

        select.innerHTML = `<option value="" disabled selected>${esc('Elige un dispositivo...')}</option>` +
            devices.map((device, index) => `<option value="${index}" data-name="${esc(device.name)}" data-kind="${esc(device.kind)}">${esc(device.name)} (${esc(pricingMachineKindLabel(device.kind))})</option>`).join('');
    }

    // ── Ajustes globales ──


    async function loadPricingCatalogsSettingsForm() {
        try {
            const response = await fetch('/api/pricing/settings');
            if (!response.ok) throw new Error();
            const settings = await response.json();
            document.getElementById('settings-currency-select').value = settings.currency || 'MXN';
            document.getElementById('settings-price-kwh-input').value = settings.price_per_kwh ?? '';
            document.getElementById('settings-labor-rate-input').value = settings.labor_rate_per_hour ?? '';
            document.getElementById('settings-prep-minutes-input').value = settings.default_prep_minutes ?? '';
            const mode = settings.margin?.mode || 'percentage';
            settingsMarginModeSwitch.setValue(mode);
            document.getElementById('settings-margin-percentage-field').hidden = mode !== 'percentage';
            document.getElementById('settings-margin-flat-field').hidden = mode !== 'flat_amount';
            document.getElementById('settings-margin-percentage-input').value = settings.margin?.percentage ?? '';
            document.getElementById('settings-margin-flat-input').value = settings.margin?.flat_amount ?? '';
            document.getElementById('settings-whatsapp-template-input').value = settings.whatsapp_message_template || '';
        } catch (error) {
            console.error(error);
        }
    }

    async function submitPricingCatalogsSettingsForm() {
        const errorEl = document.getElementById('settings-save-error');
        if (errorEl) errorEl.hidden = true;
        try {
            const mode = settingsMarginModeSwitch.getValue() || 'percentage';
            const margin = {
                mode,
                percentage: parseFloat(document.getElementById('settings-margin-percentage-input')?.value) || 0,
                flat_amount: parseFloat(document.getElementById('settings-margin-flat-input')?.value) || 0,
            };
            const formData = new FormData();
            formData.append('currency', document.getElementById('settings-currency-select')?.value || 'MXN');
            formData.append('price_per_kwh', document.getElementById('settings-price-kwh-input')?.value || '0');
            formData.append('labor_rate_per_hour', document.getElementById('settings-labor-rate-input')?.value || '0');
            formData.append('default_prep_minutes', document.getElementById('settings-prep-minutes-input')?.value || '0');
            formData.append('margin', JSON.stringify(margin));
            formData.append('whatsapp_message_template', document.getElementById('settings-whatsapp-template-input')?.value.trim() || '');

            const response = await fetch('/api/pricing/settings', { method: 'POST', body: formData });
            if (!response.ok) throw new Error();
            toast('Ajustes guardados');
            schedulePricingQuoteRefresh();
        } catch (error) {
            console.error(error);
            if (errorEl) {
                errorEl.textContent = 'No se pudieron guardar los ajustes';
                errorEl.hidden = false;
            }
        }
    }



    // ============================================================================
    // MARKUP
    // ============================================================================

    function moduleHtml() {
        return `
<section id="pricing-section" class="view-section" style="display:none">
                <main class="main-content">
                    <div class="pricing-header-bar">
                        <div class="pricing-header-bar-left">
                            <span class="pricing-header-icon">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                            </span>
                            <div>
                                <h1>Cotizador</h1>
                                <p>Calcula el costo estimado de tus trabajos de impresión 3D, láser o CNC</p>
                            </div>
                        </div>
                        <div class="pricing-header-bar-actions">
                            <button type="button" class="btn-file-action" id="pricing-new-quote-btn">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                                <span>Nueva cotización</span>
                            </button>
                            <div class="topbar-notif-wrap" id="pricing-header-menu-wrap">
                                <button type="button" class="topbar-icon-btn" id="pricing-header-menu-btn" aria-label="Más opciones">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>
                                </button>
                                <div class="topbar-menu-panel" id="pricing-header-menu-panel" hidden>
                                    <button type="button" class="topbar-menu-item" id="pricing-manage-catalogs-btn">
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                                        <span>Gestionar catálogos</span>
                                    </button>
                                    <button type="button" class="topbar-menu-item topbar-menu-item-danger" id="pricing-discard-btn">
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                        <span>Descartar borrador</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="pricing-steps-breadcrumb" id="pricing-steps-breadcrumb">
                        <div class="pricing-breadcrumb-step" id="pricing-breadcrumb-step-1">
                            <span class="pricing-breadcrumb-num">1</span>
                            <span class="pricing-breadcrumb-labels">
                                <strong>Cargar archivo</strong>
                                <small id="pricing-breadcrumb-sub-1">Selecciona un archivo</small>
                            </span>
                        </div>
                        <svg class="pricing-breadcrumb-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
                        <div class="pricing-breadcrumb-step" id="pricing-breadcrumb-step-2">
                            <span class="pricing-breadcrumb-num">2</span>
                            <span class="pricing-breadcrumb-labels">
                                <strong>Configurar trabajo</strong>
                                <small>Parámetros y material</small>
                            </span>
                        </div>
                        <svg class="pricing-breadcrumb-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
                        <div class="pricing-breadcrumb-step" id="pricing-breadcrumb-step-3">
                            <span class="pricing-breadcrumb-num">3</span>
                            <span class="pricing-breadcrumb-labels">
                                <strong>Cotización</strong>
                                <small>Revisión y cálculo</small>
                            </span>
                        </div>

                        <div class="pricing-breadcrumb-actions" id="pricing-breadcrumb-actions">
                            <button type="button" class="btn-file-action-accent" id="pricing-save-btn" disabled>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                                <span>Guardar cotización</span>
                            </button>
                            <button type="button" class="btn-file-action-decision" id="pricing-print-btn" disabled title="Guarda la cotización primero">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                                <span>Vista previa PDF</span>
                            </button>
                            <button type="button" class="btn-file-action" id="pricing-send-btn" disabled title="Guarda la cotización primero">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                                <span>Enviar cotización</span>
                            </button>
                            <button type="button" class="btn-file-action" id="pricing-whatsapp-btn" disabled title="Guarda la cotización primero">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                                <span>Enviar por WhatsApp</span>
                            </button>
                        </div>
                    </div>

                    <div class="pricing-columns">
                        <div class="pricing-col pricing-col-file">
                            <div class="pricing-card">
                                <div class="card-header-std">
                                    <span class="card-header-std-icon">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                                    </span>
                                    <span class="card-header-std-title">Archivo seleccionado</span>
                                </div>
                                <div id="pricing-file-empty">
                                    <p class="pricing-file-empty-hint">Elige el tipo de trabajo en "Configuración del trabajo" y selecciona un archivo.</p>
                                    <div class="pricing-file-breadcrumb" id="pricing-file-breadcrumb"></div>
                                    <div class="pricing-file-browser" id="pricing-file-browser"></div>
                                </div>
                                <div class="pricing-selected-file-block" id="pricing-selected-file-block" hidden>
                                    <div class="pricing-selected-file-row">
                                        <div class="pricing-selected-file-icon">
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                                        </div>
                                        <div class="pricing-selected-file-meta">
                                            <div class="pricing-selected-file-name" id="pricing-selected-file-name"></div>
                                            <div class="pricing-selected-file-sub" id="pricing-selected-file-sub"></div>
                                        </div>
                                        <button type="button" class="pricing-replace-btn" id="pricing-replace-file-btn">Reemplazar</button>
                                    </div>
                                    <div class="pricing-selected-file-thumb" id="pricing-selected-file-thumb"></div>
                                    <div class="pricing-selected-file-dims" id="pricing-selected-file-dims" hidden></div>
                                </div>
                            </div>
                            <div class="pricing-card" id="pricing-file-info-card" hidden>
                                <div class="card-header-std">
                                    <span class="card-header-std-title">Información del archivo</span>
                                </div>
                                <div class="pricing-info-list" id="pricing-file-info-list"></div>
                            </div>
                        </div>

                        <div class="pricing-col pricing-col-config">
                            <div class="pricing-card">
                                <div class="card-header-std">
                                    <span class="card-header-std-icon">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                                    </span>
                                    <span class="card-header-std-title">Configuración del trabajo</span>
                                </div>
                                <label class="pricing-label">Tipo de trabajo</label>
                                <div class="option-switch pricing-job-type-switch" id="pricing-job-type-switch">
                                    <button type="button" class="option-switch-btn active" data-value="printer">Impresión 3D</button>
                                    <button type="button" class="option-switch-btn" data-value="laser_cut">Corte Láser</button>
                                    <button type="button" class="option-switch-btn" data-value="laser_engrave">Grabado Láser</button>
                                    <button type="button" class="option-switch-btn" data-value="cnc">CNC</button>
                                </div>
                                <div class="pricing-form-grid">
                                    <div class="pricing-field">
                                        <label>Máquina</label>
                                        <select id="pricing-machine-select"></select>
                                    </div>
                                    <div class="pricing-field">
                                        <label>Material</label>
                                        <select id="pricing-material-select"></select>
                                    </div>
                                    <div class="pricing-field">
                                        <label>Color / Variante</label>
                                        <select id="pricing-color-select">
                                            <option value="">Natural</option>
                                            <option value="blanco">Blanco</option>
                                            <option value="negro">Negro</option>
                                            <option value="rojo">Rojo</option>
                                            <option value="verde">Verde</option>
                                            <option value="azul">Azul</option>
                                            <option value="amarillo">Amarillo</option>
                                            <option value="otro">Otro</option>
                                        </select>
                                    </div>
                                    <div class="pricing-field">
                                        <label>Cantidad</label>
                                        <div class="pricing-qty-stepper">
                                            <button type="button" id="pricing-qty-minus" aria-label="Menos">−</button>
                                            <input type="number" id="pricing-quantity-input" min="1" step="1" value="1">
                                            <button type="button" id="pricing-qty-plus" aria-label="Más">+</button>
                                        </div>
                                    </div>
                                </div>
                                <div class="pricing-field pricing-field-wide" id="pricing-spoolman-field" hidden>
                                    <label>Carrete de Spoolman <span class="pricing-spoolman-optional">(opcional)</span></label>
                                    <select id="pricing-spoolman-select">
                                        <option value="">Sin carrete vinculado (usar costo del material genérico)</option>
                                    </select>
                                    <div class="pricing-spoolman-info" id="pricing-spoolman-info" hidden></div>
                                    <p class="pricing-spoolman-notice" id="pricing-spoolman-notice" hidden></p>
                                </div>
                                <label class="pricing-label">Nivel de detalle</label>
                                <div class="option-switch" id="pricing-detail-level-switch">
                                    <button type="button" class="option-switch-btn" data-value="economic">Económico</button>
                                    <button type="button" class="option-switch-btn active" data-value="standard">Estándar</button>
                                    <button type="button" class="option-switch-btn" data-value="high">Alta calidad</button>
                                </div>
                                <p class="pricing-file-empty-hint">Ajusta el tiempo estimado de impresión 3D (y con eso energía y uso de máquina) — no aplica a láser/CNC.</p>
                                <div class="pricing-field pricing-field-wide">
                                    <label>Notas</label>
                                    <textarea id="pricing-notes-input" rows="2" placeholder="Notas internas o para el cliente..."></textarea>
                                </div>
                                <div class="pricing-field pricing-field-wide">
                                    <label>Consumibles / costos adicionales</label>
                                    <div class="pricing-extra-costs-list" id="pricing-extra-costs-list"></div>
                                    <button type="button" class="btn-file-action" id="pricing-add-extra-cost-btn">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                                        <span>Agregar costo</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        <aside class="pricing-col pricing-col-summary">
                            <div class="pricing-card">
                                <div class="card-header-std">
                                    <span class="card-header-std-title">Resumen de cotización</span>
                                </div>
                                <div class="pricing-form-grid">
                                    <div class="pricing-field">
                                        <label>Moneda</label>
                                        <select id="pricing-currency-select">
                                            <option value="MXN">MXN ($)</option>
                                            <option value="USD">USD ($)</option>
                                            <option value="EUR">EUR (€)</option>
                                        </select>
                                    </div>
                                    <div class="pricing-field">
                                        <label>Tipo de cambio</label>
                                        <input type="number" id="pricing-exchange-rate-input" value="1.0000" step="0.0001" min="0.0001">
                                    </div>
                                </div>
                                <div class="pricing-cost-lines" id="pricing-cost-lines">
                                    <div class="empty-state-small">Selecciona un archivo y un material para ver el costo.</div>
                                </div>
                                <div class="pricing-cost-subtotal-row" id="pricing-cost-subtotal-row" hidden>
                                    <span>Subtotal</span>
                                    <span id="pricing-cost-subtotal-amount">—</span>
                                </div>
                                <div class="pricing-cost-margin-row" id="pricing-cost-margin-row" hidden>
                                    <span><span>Margen de utilidad</span> <span class="pricing-margin-pill" id="pricing-margin-pill"></span></span>
                                    <span id="pricing-cost-margin-amount">—</span>
                                </div>
                                <div class="pricing-cost-total-row" id="pricing-cost-total-row" hidden>
                                    <span>TOTAL ESTIMADO</span>
                                    <span id="pricing-cost-total-amount">—</span>
                                </div>
                            </div>

                            <div class="pricing-card" id="pricing-additional-info-card">
                                <div class="card-header-std">
                                    <span class="card-header-std-title">Información adicional</span>
                                </div>
                                <div class="pricing-info-list" id="pricing-additional-info-list">
                                    <div class="pricing-info-row">
                                        <span>Tiempo total estimado</span>
                                        <strong id="pricing-info-total-time">—</strong>
                                    </div>
                                    <div class="pricing-info-row">
                                        <span>Fecha de cotización</span>
                                        <strong id="pricing-info-quote-date">—</strong>
                                    </div>
                                    <div class="pricing-info-row">
                                        <span>Nombre del cliente</span>
                                        <input type="text" id="pricing-client-name-input" class="pricing-info-inline-input" autocomplete="off" placeholder="Opcional">
                                    </div>
                                    <div class="pricing-info-row">
                                        <span>Teléfono del cliente</span>
                                        <input type="tel" id="pricing-client-phone-input" class="pricing-info-inline-input" autocomplete="off" placeholder="+52 55 1234 5678">
                                    </div>
                                    <div class="pricing-info-row">
                                        <span>Válido hasta</span>
                                        <input type="date" id="pricing-valid-until-input" class="pricing-info-inline-input">
                                    </div>
                                    <div class="pricing-info-row">
                                        <span>ID de cotización</span>
                                        <span class="pricing-info-id-row">
                                            <strong id="pricing-info-quote-id">—</strong>
                                            <button type="button" id="pricing-copy-id-btn" title="Copiar" hidden>
                                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                                            </button>
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </aside>

                        <div class="recent-section pricing-recent-section">
                            <div class="section-title">
                                <h2>Cotizaciones recientes</h2>
                            </div>
                            <div class="models-table-wrapper">
                                <table class="models-table" id="pricing-quotes-table">
                                    <thead>
                                        <tr>
                                            <th>ID</th>
                                            <th>Archivo</th>
                                            <th>Tipo</th>
                                            <th>Total</th>
                                            <th>Fecha</th>
                                            <th>Estado</th>
                                            <th></th>
                                        </tr>
                                    </thead>
                                    <tbody id="pricing-quotes-tbody">
                                        <tr><td colspan="7" class="empty-state">Todavía no hay cotizaciones guardadas.</td></tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </main>
            </section>
`;
    }

    function modalsHtml() {
        return `
    <div id="pricing-catalogs-modal" class="modal">
        <div class="modal-backdrop" id="pricing-catalogs-modal-backdrop"></div>
        <div class="modal-content pricing-catalogs-modal-content">
            <button class="modal-close" id="pricing-catalogs-modal-close">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
            <div class="modal-icon modal-icon-green">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            </div>
            <h2>Catálogos y ajustes de costos</h2>

            <div class="option-switch" id="pricing-catalogs-tab-switch">
                <button type="button" class="option-switch-btn active" data-value="materials">Materiales</button>
                <button type="button" class="option-switch-btn" data-value="machines">Máquinas</button>
                <button type="button" class="option-switch-btn" data-value="settings">Ajustes</button>
            </div>

            <!-- Pestaña: Materiales -->
            <div id="pricing-catalogs-tab-materials" class="pricing-catalogs-tab">
                <div class="usb-ports-list" id="pricing-materials-catalog-list"></div>
                <div class="usb-classify-name-field">
                    <label>Nombre</label>
                    <input type="text" id="material-add-name-input" autocomplete="off">
                </div>
                <div class="usb-classify-name-field">
                    <label>Tipo</label>
                    <div class="option-switch" id="material-add-kind-switch">
                        <button type="button" class="option-switch-btn active" data-value="filament">Filamento</button>
                        <button type="button" class="option-switch-btn" data-value="sheet">Lámina</button>
                        <button type="button" class="option-switch-btn" data-value="consumable">Consumible</button>
                    </div>
                </div>
                <div class="usb-classify-scan-grid">
                    <div class="usb-classify-name-field">
                        <label>Costo unitario</label>
                        <input type="number" step="any" min="0" id="material-add-unit-cost-input">
                    </div>
                    <div class="usb-classify-name-field">
                        <label>Unidad</label>
                        <select id="material-add-unit-select"></select>
                    </div>
                </div>
                <div id="material-add-extra-filament" class="usb-classify-scan-grid">
                    <div class="usb-classify-name-field">
                        <label>Densidad (g/cm³)</label>
                        <input type="number" step="any" min="0" id="material-add-density-input" value="1.24">
                    </div>
                    <div class="usb-classify-name-field">
                        <label>Diámetro (mm)</label>
                        <input type="number" step="any" min="0" id="material-add-diameter-input" value="1.75">
                    </div>
                </div>
                <div id="material-add-extra-sheet" class="usb-classify-name-field" hidden>
                    <label>Espesor (mm) — solo referencia</label>
                    <input type="number" step="any" min="0" id="material-add-thickness-input">
                </div>
                <div class="login-error" id="material-add-error" hidden></div>
                <div class="usb-classify-name-actions">
                    <button type="button" class="btn-file-action" id="material-add-btn">
                        <span>Agregar material</span>
                    </button>
                    <button type="button" class="btn-file-action btn-file-action-danger" id="material-add-cancel-edit-btn" hidden>
                        <span>Cancelar edición</span>
                    </button>
                </div>
            </div>

            <!-- Pestaña: Máquinas -->
            <div id="pricing-catalogs-tab-machines" class="pricing-catalogs-tab" hidden>
                <div class="usb-ports-list" id="pricing-machines-catalog-list"></div>
                <div class="usb-classify-name-field">
                    <label>Importar nombre desde dispositivo registrado (opcional)</label>
                    <select id="machine-import-device-select"></select>
                </div>
                <div class="usb-classify-name-field">
                    <label>Nombre</label>
                    <input type="text" id="machine-add-name-input" autocomplete="off">
                </div>
                <div class="usb-classify-name-field">
                    <label>Tipo</label>
                    <div class="option-switch" id="machine-add-kind-switch">
                        <button type="button" class="option-switch-btn active" data-value="printer">Impresora</button>
                        <button type="button" class="option-switch-btn" data-value="laser">Láser</button>
                        <button type="button" class="option-switch-btn" data-value="cnc">CNC</button>
                    </div>
                </div>
                <div class="usb-classify-scan-grid">
                    <div class="usb-classify-name-field">
                        <label>Potencia (W)</label>
                        <input type="number" step="any" min="0" id="machine-add-watts-input">
                    </div>
                    <div class="usb-classify-name-field">
                        <label>Tarifa ($/hora)</label>
                        <input type="number" step="any" min="0" id="machine-add-rate-input">
                    </div>
                </div>
                <div class="login-error" id="machine-add-error" hidden></div>
                <div class="usb-classify-name-actions">
                    <button type="button" class="btn-file-action" id="machine-add-btn">
                        <span>Agregar máquina</span>
                    </button>
                    <button type="button" class="btn-file-action btn-file-action-danger" id="machine-add-cancel-edit-btn" hidden>
                        <span>Cancelar edición</span>
                    </button>
                </div>
            </div>

            <!-- Pestaña: Ajustes globales -->
            <div id="pricing-catalogs-tab-settings" class="pricing-catalogs-tab" hidden>
                <div class="pricing-form-grid">
                    <div class="pricing-field">
                        <label>Moneda por defecto</label>
                        <select id="settings-currency-select">
                            <option value="MXN">MXN ($)</option>
                            <option value="USD">USD ($)</option>
                            <option value="EUR">EUR (€)</option>
                        </select>
                    </div>
                    <div class="pricing-field">
                        <label>Precio kWh</label>
                        <input type="number" step="any" min="0" id="settings-price-kwh-input">
                    </div>
                    <div class="pricing-field">
                        <label>Tarifa mano de obra ($/hora)</label>
                        <input type="number" step="any" min="0" id="settings-labor-rate-input">
                    </div>
                    <div class="pricing-field">
                        <label>Minutos de preparación por defecto</label>
                        <input type="number" step="any" min="0" id="settings-prep-minutes-input">
                    </div>
                </div>
                <div class="usb-classify-name-field">
                    <label>Modo de margen</label>
                    <div class="option-switch" id="settings-margin-mode-switch">
                        <button type="button" class="option-switch-btn active" data-value="percentage">Porcentaje</button>
                        <button type="button" class="option-switch-btn" data-value="flat_amount">Monto fijo</button>
                    </div>
                </div>
                <div class="pricing-form-grid">
                    <div class="pricing-field" id="settings-margin-percentage-field">
                        <label>Margen (%)</label>
                        <input type="number" step="any" min="0" id="settings-margin-percentage-input">
                    </div>
                    <div class="pricing-field" id="settings-margin-flat-field" hidden>
                        <label>Margen (monto fijo)</label>
                        <input type="number" step="any" min="0" id="settings-margin-flat-input">
                    </div>
                </div>
                <div class="pricing-field pricing-field-wide">
                    <label>Mensaje personal de WhatsApp</label>
                    <textarea id="settings-whatsapp-template-input" rows="4" placeholder="Hola {cliente}! Aquí tienes tu cotización..."></textarea>
                    <p class="pricing-file-empty-hint">Placeholders disponibles: {cliente}, {total}, {id}, {vigencia}, {link}. Déjalo vacío para usar el mensaje genérico.</p>
                </div>
                <div class="login-error" id="settings-save-error" hidden></div>
                <button type="button" class="btn-file-action" id="settings-save-btn-catalogs">
                    <span>Guardar ajustes</span>
                </button>
            </div>
        </div>
    </div>

    <!-- Enviar cotización por WhatsApp: previsualiza el mensaje default del
         backend en un textarea editable antes de abrir el link wa.me. -->
    <div id="pricing-whatsapp-modal" class="modal">
        <div class="modal-backdrop" id="pricing-whatsapp-modal-backdrop"></div>
        <div class="modal-content app-confirm-modal-content">
            <button class="modal-close" id="pricing-whatsapp-modal-close">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
            <div class="modal-icon modal-icon-green">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
            </div>
            <h2>Enviar cotización por WhatsApp</h2>
            <p>Revisa o edita el mensaje antes de abrir WhatsApp.</p>
            <div class="usb-classify-name-field">
                <label for="pricing-whatsapp-message-input">Mensaje</label>
                <textarea id="pricing-whatsapp-message-input" rows="7"></textarea>
            </div>
            <div class="usb-classify-name-actions">
                <button type="button" class="btn-file-action" id="pricing-whatsapp-confirm-btn">
                    <span>Enviar</span>
                </button>
                <button type="button" class="btn-file-action btn-file-action-danger" id="pricing-whatsapp-cancel-btn">
                    <span>Cancelar</span>
                </button>
            </div>
        </div>
    </div>
`;
    }


    // ============================================================================
    // MONTAJE
    // ============================================================================

    function mount() {
        if (document.getElementById('pricing-section')) return;
        const jobsContainer = document.querySelector('.nav-category[data-group="jobs"] .nav-category-items');
        const navButton = document.createElement('button');
        navButton.type = 'button';
        navButton.className = 'nav-item';
        navButton.dataset.section = 'pricing';
        navButton.dataset.pluginNav = PLUGIN_ID;
        navButton.title = 'Cotizador';
        navButton.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg><span>Cotizador</span>';
        // A diferencia de los demás plugins (que van al grupo "plugins" del
        // sidebar), Cotizador mantiene su lugar histórico en "Trabajos",
        // junto a "Historial de trabajos" -- así lo pidió el brief de esta
        // extracción, para no reordenar la navegación que el usuario ya
        // conoce.
        navButton.addEventListener('click', () => {
            window.switchSection?.('pricing');
            // Refresca datos cada vez que se entra a Cotizador -- antes esto
            // lo disparaba un caso especial adentro de switchSection() en
            // core (`if (sectionName === 'pricing') loadPricingSection()`);
            // ahora que el plugin es dueño de esa responsabilidad, el propio
            // botón de navegación lo dispara directamente.
            loadPricingSection();
        });
        jobsContainer?.appendChild(navButton);

        const wrapper = document.createElement('div');
        wrapper.innerHTML = moduleHtml();
        root = wrapper.firstElementChild;
        const content = document.querySelector('.content');
        content?.insertBefore(root, document.getElementById('gcode-editor-section'));

        // Los 2 modales de Cotizador (Gestionar catálogos / Enviar por
        // WhatsApp) viven en el DOM como hermanos de nivel superior en
        // index.html (no anidados en ninguna .view-section) -- se insertan
        // acá de la misma forma, como hijos directos de <body>, en vez de
        // adentro de moduleHtml() (que solo puede devolver UN nodo raíz,
        // ver wrapper.firstElementChild más arriba: cualquier hermano
        // adicional en el string quedaría descartado).
        const modalsWrapper = document.createElement('div');
        modalsWrapper.innerHTML = modalsHtml();
        modalRoots = Array.from(modalsWrapper.children);
        modalRoots.forEach(el => document.body.appendChild(el));

        window.applySidebarOrder?.();
    }

    function unmount() {
        document.querySelector(`[data-plugin-nav="${PLUGIN_ID}"]`)?.remove();
        document.getElementById('pricing-section')?.remove();
        modalRoots.forEach(el => el.remove());
        modalRoots = [];
        root = null;
    }

    // Reemplaza el bloque que antes vivía adentro de saveSettings() en
    // core (guardado bajo un `if (document.getElementById('pricing-section')
    // ?.classList.contains('active'))`) -- ahora core solo emite este evento
    // genérico sin saber nada de Cotizador, y el propio plugin decide si le
    // importa (mismo guard de "sección activa" que tenía antes, movido acá).
    window.addEventListener('nopal:language-changed', () => {
        if (!document.getElementById('pricing-section')?.classList.contains('active')) return;
        renderPricingExtraCosts();
        renderPricingCostSummary(pricingLastQuoteResult);
        renderPricingFileInfo(pricingLastQuoteResult);
        updatePricingBreadcrumbState();
        loadPricingQuotesHistory();
    });

    window.NopalPluginRegistry = window.NopalPluginRegistry || {};
    window.NopalPluginRegistry[PLUGIN_ID] = { mount, unmount, version: '1.0.0' };
    mount();
})();
