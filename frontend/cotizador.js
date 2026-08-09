// Cotizador -- plugin de NOPAL (calculadora de precios).
//
// Extraído de NOPAL core (lift-and-shift, sin cambios de comportamiento):
// las funciones de acá abajo son las mismas que vivían en app.js, solo
// reempaquetadas como plugin self-mounting (patrón NopalPluginRegistry, ver
// arduino-accessories/camera-viewer para el mismo patrón). Los endpoints
// /api/pricing/* que consume no cambiaron de URL.
(function () {
    const PLUGIN_ID = 'cotizador';
    const PLUGIN_VERSION = '1.1.0';

    // I18N -- debe ir antes de PRICING_JOB_TYPE_LABELS/PRICING_COST_LINE_LABELS/
    // PRICING_STATUS_LABELS, que llaman tr() en su literal de inicialización
    // (mismo patrón que matriz-led/arduino-accessories/camera-viewer). El
    // listener 'nopal:language-changed' al final del archivo ya existía antes
    // de este trabajo (movido de app.js tal cual) y vuelve a renderizar todo
    // lo que usa tr() cuando el usuario cambia de idioma en caliente.
    const I18N = {
        es: {
            jobTypePrinter: 'Impresión 3D', jobTypeLaserCut: 'Corte Láser',
            jobTypeLaserEngrave: 'Grabado Láser', jobTypeCnc: 'CNC',
            costLineMaterial: 'Material', costLineElectricity: 'Energía',
            costLineMachineUsage: 'Uso de máquina', costLineLabor: 'Mano de obra',
            costLineConsumables: 'Consumibles', costLineAdditional: 'Costos adicionales',
            statusDraft: 'Borrador', statusSent: 'Enviada', statusApproved: 'Aprobada', statusRejected: 'Rechazada',
            idCopied: 'ID copiado',
            couldNotLoadFolder: 'No se pudo cargar la carpeta',
            loadingEllipsis: 'Cargando...',
            noFilesFound: 'No se encontraron archivos.',
            couldNotCalculateQuote: 'No se pudo calcular la cotización.',
            selectFileAndMaterial: 'Selecciona un archivo y un material para ver el costo.',
            saveQuoteFirstHint: 'Guarda la cotización primero',
            quoteSaved: 'Cotización guardada',
            couldNotSaveQuote: 'No se pudo guardar la cotización.',
            quoteMarkedSent: 'Cotización marcada como enviada',
            couldNotUpdateQuoteStatus: 'No se pudo actualizar el estado de la cotización.',
            couldNotGenerateWhatsappLink: 'No se pudo generar el link de WhatsApp.',
            couldNotLoadHistory: 'No se pudo cargar el historial',
            noQuotesSaved: 'Todavía no hay cotizaciones guardadas.',
            previewPdfTitle: 'Vista previa PDF', loadQuoteTitle: 'Cargar cotización', deleteQuoteTitle: 'Eliminar cotización',
            quoteLoaded: 'Cotización cargada',
            couldNotLoadQuote: 'No se pudo cargar la cotización.',
            confirmDeleteQuote: '¿Eliminar esta cotización?',
            quoteDeleted: 'Cotización eliminada.',
            couldNotDeleteQuote: 'No se pudo eliminar la cotización.',
            noMaterialsOfType: 'No hay materiales de este tipo en el catálogo',
            noSpecificMachine: 'Sin máquina específica',
            breadcrumbRootPrinting: 'Impresión 3D', breadcrumbRootLaserCnc: 'Láser / CNC',
            costDescriptionPlaceholder: 'Descripción del costo',
            costCategoryConsumable: 'Consumible', costCategoryAdditional: 'Adicional',
            removeBtn: 'Quitar',
            workTypeLabel: 'Tipo de trabajo',
            estimatedTimeLabel: 'Tiempo estimado', estimatedWeightLabel: 'Peso estimado',
            cutLengthLabel: 'Largo de corte', areaLabel: 'Área',
            widthLabel: 'Ancho:', heightLabel: 'Alto:',
            preparationSupervisionDetail: 'Preparación y supervisión ({minutes} min)',
            machineUsageDetail: '{time} a ${rate}/h',
            noMaterialsInCatalog: 'Todavía no hay materiales en el catálogo.',
            noMachinesInCatalog: 'Todavía no hay máquinas en el catálogo.',
            editMaterialTitle: 'Editar material', deleteMaterialTitle: 'Eliminar material',
            editMachineTitle: 'Editar máquina', deleteMachineTitle: 'Eliminar máquina',
            fillNameAndUnitCost: 'Completa nombre y costo unitario',
            materialUpdated: 'Material actualizado', materialAdded: 'Material agregado',
            couldNotSaveMaterial: 'No se pudo guardar el material',
            confirmDeleteMaterial: '¿Eliminar este material del catálogo?', deleteMaterialConfirmTitle: 'Eliminar material',
            fillNameWattsRate: 'Completa nombre, watts y tarifa',
            machineUpdated: 'Máquina actualizada', machineAdded: 'Máquina agregada',
            couldNotSaveMachine: 'No se pudo guardar la máquina',
            confirmDeleteMachine: '¿Eliminar esta máquina del catálogo?', deleteMachineConfirmTitle: 'Eliminar máquina',
            noDevicesFound: 'No se encontraron dispositivos registrados',
            chooseADevice: 'Elige un dispositivo...',
            settingsSaved: 'Ajustes guardados',
            couldNotSaveSettings: 'No se pudieron guardar los ajustes',
            matKindFilament: 'Filamento', matKindSheet: 'Lámina', matKindConsumable: 'Consumible',
            machKindPrinter: 'Impresora', machKindLaser: 'Láser', machKindCnc: 'CNC',
            pageTitleCotizador: 'Cotizador',
            pageSubtitle: 'Calcula el costo estimado de tus trabajos de impresión 3D, láser o CNC',
            newQuoteBtn: 'Nueva cotización', moreOptionsAriaLabel: 'Más opciones',
            manageCatalogsBtn: 'Gestionar catálogos', discardDraftBtn: 'Descartar borrador',
            breadcrumbStep1Title: 'Cargar archivo', breadcrumbStep1SubDefault: 'Selecciona un archivo', breadcrumbStep1SubDone: 'Archivo seleccionado',
            breadcrumbStep2Title: 'Configurar trabajo', breadcrumbStep2Sub: 'Parámetros y material',
            breadcrumbStep3Title: 'Cotización', breadcrumbStep3Sub: 'Revisión y cálculo',
            saveQuoteBtn: 'Guardar cotización', previewPdfBtn: 'Vista previa PDF',
            sendQuoteBtn: 'Enviar cotización', sendWhatsappBtn: 'Enviar por WhatsApp',
            selectedFileTitle: 'Archivo seleccionado',
            selectFileHint: 'Elige el tipo de trabajo en "Configuración del trabajo" y selecciona un archivo.',
            replaceBtn: 'Reemplazar',
            fileInfoTitle: 'Información del archivo',
            jobConfigTitle: 'Configuración del trabajo',
            machineLabel: 'Máquina', materialLabel: 'Material', colorVariantLabel: 'Color / Variante',
            colorNatural: 'Natural', colorWhite: 'Blanco', colorBlack: 'Negro', colorRed: 'Rojo',
            colorGreen: 'Verde', colorBlue: 'Azul', colorYellow: 'Amarillo', colorOther: 'Otro',
            quantityLabel: 'Cantidad', lessAriaLabel: 'Menos', moreAriaLabel: 'Más',
            spoolmanSpoolLabel: 'Carrete de Spoolman', optionalSuffix: '(opcional)',
            spoolmanDefaultOption: 'Sin carrete vinculado (usar costo del material genérico)',
            spoolmanNotInstalledNotice: 'El consumo real de filamento (colores, tipo y disponibilidad) solo se ve acá si tenés instalado el plugin Materiales (Spoolman). Mientras tanto se usa el costo del material genérico.',
            spoolmanNotConfiguredNotice: 'El plugin Materiales (Spoolman) está instalado pero todavía no está conectado a un servidor -- configuralo en Configuración → Plugins → Materiales para ver el inventario real acá.',
            spoolmanCarreteFallback: 'Carrete',
            gAvailableSuffix: 'g disponibles',
            spoolmanMaterialFallback: 'Filamento',
            detailLevelLabel: 'Nivel de detalle',
            detailEconomic: 'Económico', detailStandard: 'Estándar', detailHigh: 'Alta calidad',
            detailLevelHint: 'Ajusta el tiempo estimado de impresión 3D (y con eso energía y uso de máquina) — no aplica a láser/CNC.',
            notesLabel: 'Notas', notesPlaceholder: 'Notas internas o para el cliente...',
            extraCostsLabel: 'Consumibles / costos adicionales', addCostBtn: 'Agregar costo',
            quoteSummaryTitle: 'Resumen de cotización', currencyLabel: 'Moneda', exchangeRateLabel: 'Tipo de cambio',
            subtotalLabel: 'Subtotal', marginLabel: 'Margen de utilidad', totalEstimatedLabel: 'TOTAL ESTIMADO',
            additionalInfoTitle: 'Información adicional', totalEstimatedTimeLabel: 'Tiempo total estimado',
            quoteDateLabel: 'Fecha de cotización', clientNameLabel: 'Nombre del cliente', optionalPlaceholder: 'Opcional',
            clientPhoneLabel: 'Teléfono del cliente', validUntilLabel: 'Válido hasta',
            quoteIdLabel: 'ID de cotización', copyTitle: 'Copiar',
            recentQuotesTitle: 'Cotizaciones recientes',
            tableHeaderId: 'ID', tableHeaderFile: 'Archivo', tableHeaderType: 'Tipo', tableHeaderTotal: 'Total',
            tableHeaderDate: 'Fecha', tableHeaderStatus: 'Estado',
            catalogsModalTitle: 'Catálogos y ajustes de costos',
            tabMaterials: 'Materiales', tabMachines: 'Máquinas', tabSettings: 'Ajustes',
            nameLabel: 'Nombre', typeLabel: 'Tipo',
            unitCostLabel: 'Costo unitario', unitLabel: 'Unidad',
            densityLabel: 'Densidad (g/cm³)', diameterLabel: 'Diámetro (mm)',
            thicknessLabel: 'Espesor (mm) — solo referencia',
            addMaterialBtn: 'Agregar material', saveChangesBtn: 'Guardar cambios', cancelEditBtn: 'Cancelar edición',
            importDeviceNameLabel: 'Importar nombre desde dispositivo registrado (opcional)',
            wattsLabel: 'Potencia (W)', rateLabel: 'Tarifa ($/hora)',
            addMachineBtn: 'Agregar máquina',
            defaultCurrencyLabel: 'Moneda por defecto', priceKwhLabel: 'Precio kWh',
            laborRateLabel: 'Tarifa mano de obra ($/hora)', prepMinutesLabel: 'Minutos de preparación por defecto',
            marginModeLabel: 'Modo de margen', marginModePercentage: 'Porcentaje', marginModeFlat: 'Monto fijo',
            marginPercentLabel: 'Margen (%)', marginFlatLabel: 'Margen (monto fijo)',
            whatsappTemplateLabel: 'Mensaje personal de WhatsApp',
            whatsappTemplatePlaceholder: 'Hola {cliente}! Aquí tienes tu cotización...',
            whatsappTemplateHint: 'Placeholders disponibles: {cliente}, {total}, {id}, {vigencia}, {link}. Déjalo vacío para usar el mensaje genérico.',
            saveSettingsBtn: 'Guardar ajustes',
            sendWhatsappModalTitle: 'Enviar cotización por WhatsApp',
            sendWhatsappModalHint: 'Revisa o edita el mensaje antes de abrir WhatsApp.',
            messageLabel: 'Mensaje', sendBtn: 'Enviar', cancelBtn: 'Cancelar',
        },
        en: {
            jobTypePrinter: '3D Printing', jobTypeLaserCut: 'Laser Cut',
            jobTypeLaserEngrave: 'Laser Engrave', jobTypeCnc: 'CNC',
            costLineMaterial: 'Material', costLineElectricity: 'Electricity',
            costLineMachineUsage: 'Machine usage', costLineLabor: 'Labor',
            costLineConsumables: 'Consumables', costLineAdditional: 'Additional costs',
            statusDraft: 'Draft', statusSent: 'Sent', statusApproved: 'Approved', statusRejected: 'Rejected',
            idCopied: 'ID copied',
            couldNotLoadFolder: 'Could not load the folder',
            loadingEllipsis: 'Loading...',
            noFilesFound: 'No files found.',
            couldNotCalculateQuote: 'Could not calculate the quote.',
            selectFileAndMaterial: 'Select a file and a material to see the cost.',
            saveQuoteFirstHint: 'Save the quote first',
            quoteSaved: 'Quote saved',
            couldNotSaveQuote: 'Could not save the quote.',
            quoteMarkedSent: 'Quote marked as sent',
            couldNotUpdateQuoteStatus: 'Could not update the quote status.',
            couldNotGenerateWhatsappLink: 'Could not generate the WhatsApp link.',
            couldNotLoadHistory: 'Could not load the history',
            noQuotesSaved: 'No quotes saved yet.',
            previewPdfTitle: 'PDF preview', loadQuoteTitle: 'Load quote', deleteQuoteTitle: 'Delete quote',
            quoteLoaded: 'Quote loaded',
            couldNotLoadQuote: 'Could not load the quote.',
            confirmDeleteQuote: 'Delete this quote?',
            quoteDeleted: 'Quote deleted.',
            couldNotDeleteQuote: 'Could not delete the quote.',
            noMaterialsOfType: 'No materials of this type in the catalog',
            noSpecificMachine: 'No specific machine',
            breadcrumbRootPrinting: '3D Printing', breadcrumbRootLaserCnc: 'Laser / CNC',
            costDescriptionPlaceholder: 'Cost description',
            costCategoryConsumable: 'Consumable', costCategoryAdditional: 'Additional',
            removeBtn: 'Remove',
            workTypeLabel: 'Job type',
            estimatedTimeLabel: 'Estimated time', estimatedWeightLabel: 'Estimated weight',
            cutLengthLabel: 'Cut length', areaLabel: 'Area',
            widthLabel: 'Width:', heightLabel: 'Height:',
            preparationSupervisionDetail: 'Preparation and supervision ({minutes} min)',
            machineUsageDetail: '{time} at ${rate}/h',
            noMaterialsInCatalog: 'No materials in the catalog yet.',
            noMachinesInCatalog: 'No machines in the catalog yet.',
            editMaterialTitle: 'Edit material', deleteMaterialTitle: 'Delete material',
            editMachineTitle: 'Edit machine', deleteMachineTitle: 'Delete machine',
            fillNameAndUnitCost: 'Fill in the name and unit cost',
            materialUpdated: 'Material updated', materialAdded: 'Material added',
            couldNotSaveMaterial: 'Could not save the material',
            confirmDeleteMaterial: 'Delete this material from the catalog?', deleteMaterialConfirmTitle: 'Delete material',
            fillNameWattsRate: 'Fill in the name, watts, and rate',
            machineUpdated: 'Machine updated', machineAdded: 'Machine added',
            couldNotSaveMachine: 'Could not save the machine',
            confirmDeleteMachine: 'Delete this machine from the catalog?', deleteMachineConfirmTitle: 'Delete machine',
            noDevicesFound: 'No registered devices found',
            chooseADevice: 'Choose a device...',
            settingsSaved: 'Settings saved',
            couldNotSaveSettings: 'Could not save the settings',
            matKindFilament: 'Filament', matKindSheet: 'Sheet', matKindConsumable: 'Consumable',
            machKindPrinter: 'Printer', machKindLaser: 'Laser', machKindCnc: 'CNC',
            pageTitleCotizador: 'Quoting Tool',
            pageSubtitle: 'Calculate the estimated cost of your 3D printing, laser, or CNC jobs',
            newQuoteBtn: 'New quote', moreOptionsAriaLabel: 'More options',
            manageCatalogsBtn: 'Manage catalogs', discardDraftBtn: 'Discard draft',
            breadcrumbStep1Title: 'Load file', breadcrumbStep1SubDefault: 'Select a file', breadcrumbStep1SubDone: 'File selected',
            breadcrumbStep2Title: 'Configure job', breadcrumbStep2Sub: 'Parameters and material',
            breadcrumbStep3Title: 'Quote', breadcrumbStep3Sub: 'Review and calculation',
            saveQuoteBtn: 'Save quote', previewPdfBtn: 'PDF preview',
            sendQuoteBtn: 'Send quote', sendWhatsappBtn: 'Send via WhatsApp',
            selectedFileTitle: 'Selected file',
            selectFileHint: 'Choose the job type in "Job configuration" and select a file.',
            replaceBtn: 'Replace',
            fileInfoTitle: 'File information',
            jobConfigTitle: 'Job configuration',
            machineLabel: 'Machine', materialLabel: 'Material', colorVariantLabel: 'Color / Variant',
            colorNatural: 'Natural', colorWhite: 'White', colorBlack: 'Black', colorRed: 'Red',
            colorGreen: 'Green', colorBlue: 'Blue', colorYellow: 'Yellow', colorOther: 'Other',
            quantityLabel: 'Quantity', lessAriaLabel: 'Less', moreAriaLabel: 'More',
            spoolmanSpoolLabel: 'Spoolman spool', optionalSuffix: '(optional)',
            spoolmanDefaultOption: 'No spool linked (use generic material cost)',
            spoolmanNotInstalledNotice: 'Real filament consumption (colors, type, and availability) only shows up here if you have the Materials plugin (Spoolman) installed. Meanwhile the generic material cost is used.',
            spoolmanNotConfiguredNotice: 'The Materials plugin (Spoolman) is installed but not yet connected to a server -- set it up in Settings → Plugins → Materials to see the real inventory here.',
            spoolmanCarreteFallback: 'Spool',
            gAvailableSuffix: 'g available',
            spoolmanMaterialFallback: 'Filament',
            detailLevelLabel: 'Detail level',
            detailEconomic: 'Economic', detailStandard: 'Standard', detailHigh: 'High quality',
            detailLevelHint: 'Adjusts the estimated 3D printing time (and with it electricity and machine usage) -- does not apply to laser/CNC.',
            notesLabel: 'Notes', notesPlaceholder: 'Internal notes or notes for the client...',
            extraCostsLabel: 'Consumables / additional costs', addCostBtn: 'Add cost',
            quoteSummaryTitle: 'Quote summary', currencyLabel: 'Currency', exchangeRateLabel: 'Exchange rate',
            subtotalLabel: 'Subtotal', marginLabel: 'Profit margin', totalEstimatedLabel: 'ESTIMATED TOTAL',
            additionalInfoTitle: 'Additional information', totalEstimatedTimeLabel: 'Total estimated time',
            quoteDateLabel: 'Quote date', clientNameLabel: 'Client name', optionalPlaceholder: 'Optional',
            clientPhoneLabel: 'Client phone', validUntilLabel: 'Valid until',
            quoteIdLabel: 'Quote ID', copyTitle: 'Copy',
            recentQuotesTitle: 'Recent quotes',
            tableHeaderId: 'ID', tableHeaderFile: 'File', tableHeaderType: 'Type', tableHeaderTotal: 'Total',
            tableHeaderDate: 'Date', tableHeaderStatus: 'Status',
            catalogsModalTitle: 'Catalogs and cost settings',
            tabMaterials: 'Materials', tabMachines: 'Machines', tabSettings: 'Settings',
            nameLabel: 'Name', typeLabel: 'Type',
            unitCostLabel: 'Unit cost', unitLabel: 'Unit',
            densityLabel: 'Density (g/cm³)', diameterLabel: 'Diameter (mm)',
            thicknessLabel: 'Thickness (mm) — reference only',
            addMaterialBtn: 'Add material', saveChangesBtn: 'Save changes', cancelEditBtn: 'Cancel edit',
            importDeviceNameLabel: 'Import name from a registered device (optional)',
            wattsLabel: 'Power (W)', rateLabel: 'Rate ($/hour)',
            addMachineBtn: 'Add machine',
            defaultCurrencyLabel: 'Default currency', priceKwhLabel: 'kWh price',
            laborRateLabel: 'Labor rate ($/hour)', prepMinutesLabel: 'Default prep minutes',
            marginModeLabel: 'Margin mode', marginModePercentage: 'Percentage', marginModeFlat: 'Flat amount',
            marginPercentLabel: 'Margin (%)', marginFlatLabel: 'Margin (flat amount)',
            whatsappTemplateLabel: 'Personal WhatsApp message',
            whatsappTemplatePlaceholder: 'Hi {cliente}! Here is your quote...',
            whatsappTemplateHint: 'Available placeholders: {cliente}, {total}, {id}, {vigencia}, {link}. Leave empty to use the generic message.',
            saveSettingsBtn: 'Save settings',
            sendWhatsappModalTitle: 'Send quote via WhatsApp',
            sendWhatsappModalHint: 'Review or edit the message before opening WhatsApp.',
            messageLabel: 'Message', sendBtn: 'Send', cancelBtn: 'Cancel',
        },
        de: {
            jobTypePrinter: '3D-Druck', jobTypeLaserCut: 'Laserschnitt',
            jobTypeLaserEngrave: 'Lasergravur', jobTypeCnc: 'CNC',
            costLineMaterial: 'Material', costLineElectricity: 'Strom',
            costLineMachineUsage: 'Maschinennutzung', costLineLabor: 'Arbeitskraft',
            costLineConsumables: 'Verbrauchsmaterial', costLineAdditional: 'Zusatzkosten',
            statusDraft: 'Entwurf', statusSent: 'Gesendet', statusApproved: 'Genehmigt', statusRejected: 'Abgelehnt',
            idCopied: 'ID kopiert',
            couldNotLoadFolder: 'Der Ordner konnte nicht geladen werden',
            loadingEllipsis: 'Wird geladen...',
            noFilesFound: 'Keine Dateien gefunden.',
            couldNotCalculateQuote: 'Das Angebot konnte nicht berechnet werden.',
            selectFileAndMaterial: 'Wähle eine Datei und ein Material, um die Kosten zu sehen.',
            saveQuoteFirstHint: 'Speichere zuerst das Angebot',
            quoteSaved: 'Angebot gespeichert',
            couldNotSaveQuote: 'Das Angebot konnte nicht gespeichert werden.',
            quoteMarkedSent: 'Angebot als gesendet markiert',
            couldNotUpdateQuoteStatus: 'Der Angebotsstatus konnte nicht aktualisiert werden.',
            couldNotGenerateWhatsappLink: 'Der WhatsApp-Link konnte nicht erstellt werden.',
            couldNotLoadHistory: 'Der Verlauf konnte nicht geladen werden',
            noQuotesSaved: 'Noch keine Angebote gespeichert.',
            previewPdfTitle: 'PDF-Vorschau', loadQuoteTitle: 'Angebot laden', deleteQuoteTitle: 'Angebot löschen',
            quoteLoaded: 'Angebot geladen',
            couldNotLoadQuote: 'Das Angebot konnte nicht geladen werden.',
            confirmDeleteQuote: 'Dieses Angebot löschen?',
            quoteDeleted: 'Angebot gelöscht.',
            couldNotDeleteQuote: 'Das Angebot konnte nicht gelöscht werden.',
            noMaterialsOfType: 'Keine Materialien dieses Typs im Katalog',
            noSpecificMachine: 'Keine bestimmte Maschine',
            breadcrumbRootPrinting: '3D-Druck', breadcrumbRootLaserCnc: 'Laser / CNC',
            costDescriptionPlaceholder: 'Kostenbeschreibung',
            costCategoryConsumable: 'Verbrauchsmaterial', costCategoryAdditional: 'Zusätzlich',
            removeBtn: 'Entfernen',
            workTypeLabel: 'Auftragsart',
            estimatedTimeLabel: 'Geschätzte Zeit', estimatedWeightLabel: 'Geschätztes Gewicht',
            cutLengthLabel: 'Schnittlänge', areaLabel: 'Fläche',
            widthLabel: 'Breite:', heightLabel: 'Höhe:',
            preparationSupervisionDetail: 'Vorbereitung und Überwachung ({minutes} Min.)',
            machineUsageDetail: '{time} zu ${rate}/h',
            noMaterialsInCatalog: 'Noch keine Materialien im Katalog.',
            noMachinesInCatalog: 'Noch keine Maschinen im Katalog.',
            editMaterialTitle: 'Material bearbeiten', deleteMaterialTitle: 'Material löschen',
            editMachineTitle: 'Maschine bearbeiten', deleteMachineTitle: 'Maschine löschen',
            fillNameAndUnitCost: 'Name und Stückkosten ausfüllen',
            materialUpdated: 'Material aktualisiert', materialAdded: 'Material hinzugefügt',
            couldNotSaveMaterial: 'Das Material konnte nicht gespeichert werden',
            confirmDeleteMaterial: 'Dieses Material aus dem Katalog löschen?', deleteMaterialConfirmTitle: 'Material löschen',
            fillNameWattsRate: 'Name, Watt und Tarif ausfüllen',
            machineUpdated: 'Maschine aktualisiert', machineAdded: 'Maschine hinzugefügt',
            couldNotSaveMachine: 'Die Maschine konnte nicht gespeichert werden',
            confirmDeleteMachine: 'Diese Maschine aus dem Katalog löschen?', deleteMachineConfirmTitle: 'Maschine löschen',
            noDevicesFound: 'Keine registrierten Geräte gefunden',
            chooseADevice: 'Wähle ein Gerät...',
            settingsSaved: 'Einstellungen gespeichert',
            couldNotSaveSettings: 'Die Einstellungen konnten nicht gespeichert werden',
            matKindFilament: 'Filament', matKindSheet: 'Platte', matKindConsumable: 'Verbrauchsmaterial',
            machKindPrinter: 'Drucker', machKindLaser: 'Laser', machKindCnc: 'CNC',
            pageTitleCotizador: 'Preisrechner',
            pageSubtitle: 'Berechne die geschätzten Kosten deiner 3D-Druck-, Laser- oder CNC-Aufträge',
            newQuoteBtn: 'Neues Angebot', moreOptionsAriaLabel: 'Weitere Optionen',
            manageCatalogsBtn: 'Kataloge verwalten', discardDraftBtn: 'Entwurf verwerfen',
            breadcrumbStep1Title: 'Datei laden', breadcrumbStep1SubDefault: 'Wähle eine Datei', breadcrumbStep1SubDone: 'Datei ausgewählt',
            breadcrumbStep2Title: 'Auftrag konfigurieren', breadcrumbStep2Sub: 'Parameter und Material',
            breadcrumbStep3Title: 'Angebot', breadcrumbStep3Sub: 'Prüfung und Berechnung',
            saveQuoteBtn: 'Angebot speichern', previewPdfBtn: 'PDF-Vorschau',
            sendQuoteBtn: 'Angebot senden', sendWhatsappBtn: 'Über WhatsApp senden',
            selectedFileTitle: 'Ausgewählte Datei',
            selectFileHint: 'Wähle die Auftragsart unter "Auftrag konfigurieren" und wähle eine Datei aus.',
            replaceBtn: 'Ersetzen',
            fileInfoTitle: 'Dateiinformationen',
            jobConfigTitle: 'Auftrag konfigurieren',
            machineLabel: 'Maschine', materialLabel: 'Material', colorVariantLabel: 'Farbe / Variante',
            colorNatural: 'Natur', colorWhite: 'Weiß', colorBlack: 'Schwarz', colorRed: 'Rot',
            colorGreen: 'Grün', colorBlue: 'Blau', colorYellow: 'Gelb', colorOther: 'Andere',
            quantityLabel: 'Menge', lessAriaLabel: 'Weniger', moreAriaLabel: 'Mehr',
            spoolmanSpoolLabel: 'Spoolman-Spule', optionalSuffix: '(optional)',
            spoolmanDefaultOption: 'Keine Spule verknüpft (allgemeine Materialkosten verwenden)',
            spoolmanNotInstalledNotice: 'Der tatsächliche Filamentverbrauch (Farben, Typ und Verfügbarkeit) wird hier nur angezeigt, wenn das Materialien-Plugin (Spoolman) installiert ist. In der Zwischenzeit werden die allgemeinen Materialkosten verwendet.',
            spoolmanNotConfiguredNotice: 'Das Materialien-Plugin (Spoolman) ist installiert, aber noch nicht mit einem Server verbunden -- richte es unter Einstellungen → Plugins → Materialien ein, um hier den echten Bestand zu sehen.',
            spoolmanCarreteFallback: 'Spule',
            gAvailableSuffix: 'g verfügbar',
            spoolmanMaterialFallback: 'Filament',
            detailLevelLabel: 'Detailgrad',
            detailEconomic: 'Sparsam', detailStandard: 'Standard', detailHigh: 'Hohe Qualität',
            detailLevelHint: 'Passt die geschätzte 3D-Druckzeit an (und damit Strom und Maschinennutzung) -- gilt nicht für Laser/CNC.',
            notesLabel: 'Notizen', notesPlaceholder: 'Interne Notizen oder Notizen für den Kunden...',
            extraCostsLabel: 'Verbrauchsmaterial / Zusatzkosten', addCostBtn: 'Kosten hinzufügen',
            quoteSummaryTitle: 'Angebotsübersicht', currencyLabel: 'Währung', exchangeRateLabel: 'Wechselkurs',
            subtotalLabel: 'Zwischensumme', marginLabel: 'Gewinnspanne', totalEstimatedLabel: 'GESCHÄTZTE SUMME',
            additionalInfoTitle: 'Zusätzliche Informationen', totalEstimatedTimeLabel: 'Geschätzte Gesamtzeit',
            quoteDateLabel: 'Angebotsdatum', clientNameLabel: 'Kundenname', optionalPlaceholder: 'Optional',
            clientPhoneLabel: 'Telefon des Kunden', validUntilLabel: 'Gültig bis',
            quoteIdLabel: 'Angebots-ID', copyTitle: 'Kopieren',
            recentQuotesTitle: 'Letzte Angebote',
            tableHeaderId: 'ID', tableHeaderFile: 'Datei', tableHeaderType: 'Typ', tableHeaderTotal: 'Summe',
            tableHeaderDate: 'Datum', tableHeaderStatus: 'Status',
            catalogsModalTitle: 'Kataloge und Kosteneinstellungen',
            tabMaterials: 'Materialien', tabMachines: 'Maschinen', tabSettings: 'Einstellungen',
            nameLabel: 'Name', typeLabel: 'Typ',
            unitCostLabel: 'Stückkosten', unitLabel: 'Einheit',
            densityLabel: 'Dichte (g/cm³)', diameterLabel: 'Durchmesser (mm)',
            thicknessLabel: 'Dicke (mm) — nur Referenz',
            addMaterialBtn: 'Material hinzufügen', saveChangesBtn: 'Änderungen speichern', cancelEditBtn: 'Bearbeitung abbrechen',
            importDeviceNameLabel: 'Namen von registriertem Gerät importieren (optional)',
            wattsLabel: 'Leistung (W)', rateLabel: 'Tarif ($/Stunde)',
            addMachineBtn: 'Maschine hinzufügen',
            defaultCurrencyLabel: 'Standardwährung', priceKwhLabel: 'kWh-Preis',
            laborRateLabel: 'Arbeitskosten ($/Stunde)', prepMinutesLabel: 'Standard-Vorbereitungsminuten',
            marginModeLabel: 'Margenmodus', marginModePercentage: 'Prozentsatz', marginModeFlat: 'Fester Betrag',
            marginPercentLabel: 'Marge (%)', marginFlatLabel: 'Marge (fester Betrag)',
            whatsappTemplateLabel: 'Persönliche WhatsApp-Nachricht',
            whatsappTemplatePlaceholder: 'Hallo {cliente}! Hier ist dein Angebot...',
            whatsappTemplateHint: 'Verfügbare Platzhalter: {cliente}, {total}, {id}, {vigencia}, {link}. Leer lassen, um die allgemeine Nachricht zu verwenden.',
            saveSettingsBtn: 'Einstellungen speichern',
            sendWhatsappModalTitle: 'Angebot über WhatsApp senden',
            sendWhatsappModalHint: 'Überprüfe oder bearbeite die Nachricht, bevor du WhatsApp öffnest.',
            messageLabel: 'Nachricht', sendBtn: 'Senden', cancelBtn: 'Abbrechen',
        },
        fr: {
            jobTypePrinter: 'Impression 3D', jobTypeLaserCut: 'Découpe laser',
            jobTypeLaserEngrave: 'Gravure laser', jobTypeCnc: 'CNC',
            costLineMaterial: 'Matériau', costLineElectricity: 'Électricité',
            costLineMachineUsage: 'Utilisation de la machine', costLineLabor: "Main-d'œuvre",
            costLineConsumables: 'Consommables', costLineAdditional: 'Coûts additionnels',
            statusDraft: 'Brouillon', statusSent: 'Envoyée', statusApproved: 'Approuvée', statusRejected: 'Rejetée',
            idCopied: 'ID copié',
            couldNotLoadFolder: 'Impossible de charger le dossier',
            loadingEllipsis: 'Chargement...',
            noFilesFound: 'Aucun fichier trouvé.',
            couldNotCalculateQuote: 'Impossible de calculer le devis.',
            selectFileAndMaterial: 'Sélectionnez un fichier et un matériau pour voir le coût.',
            saveQuoteFirstHint: "Enregistrez d'abord le devis",
            quoteSaved: 'Devis enregistré',
            couldNotSaveQuote: "Impossible d'enregistrer le devis.",
            quoteMarkedSent: 'Devis marqué comme envoyé',
            couldNotUpdateQuoteStatus: "Impossible de mettre à jour l'état du devis.",
            couldNotGenerateWhatsappLink: 'Impossible de générer le lien WhatsApp.',
            couldNotLoadHistory: "Impossible de charger l'historique",
            noQuotesSaved: "Aucun devis enregistré pour l'instant.",
            previewPdfTitle: 'Aperçu PDF', loadQuoteTitle: 'Charger le devis', deleteQuoteTitle: 'Supprimer le devis',
            quoteLoaded: 'Devis chargé',
            couldNotLoadQuote: 'Impossible de charger le devis.',
            confirmDeleteQuote: 'Supprimer ce devis ?',
            quoteDeleted: 'Devis supprimé.',
            couldNotDeleteQuote: 'Impossible de supprimer le devis.',
            noMaterialsOfType: 'Aucun matériau de ce type dans le catalogue',
            noSpecificMachine: 'Aucune machine spécifique',
            breadcrumbRootPrinting: 'Impression 3D', breadcrumbRootLaserCnc: 'Laser / CNC',
            costDescriptionPlaceholder: 'Description du coût',
            costCategoryConsumable: 'Consommable', costCategoryAdditional: 'Additionnel',
            removeBtn: 'Retirer',
            workTypeLabel: 'Type de travail',
            estimatedTimeLabel: 'Temps estimé', estimatedWeightLabel: 'Poids estimé',
            cutLengthLabel: 'Longueur de coupe', areaLabel: 'Surface',
            widthLabel: 'Largeur :', heightLabel: 'Hauteur :',
            preparationSupervisionDetail: 'Préparation et supervision ({minutes} min)',
            machineUsageDetail: '{time} à ${rate}/h',
            noMaterialsInCatalog: 'Pas encore de matériaux dans le catalogue.',
            noMachinesInCatalog: 'Pas encore de machines dans le catalogue.',
            editMaterialTitle: 'Modifier le matériau', deleteMaterialTitle: 'Supprimer le matériau',
            editMachineTitle: 'Modifier la machine', deleteMachineTitle: 'Supprimer la machine',
            fillNameAndUnitCost: 'Complétez le nom et le coût unitaire',
            materialUpdated: 'Matériau mis à jour', materialAdded: 'Matériau ajouté',
            couldNotSaveMaterial: "Impossible d'enregistrer le matériau",
            confirmDeleteMaterial: 'Supprimer ce matériau du catalogue ?', deleteMaterialConfirmTitle: 'Supprimer le matériau',
            fillNameWattsRate: 'Complétez le nom, les watts et le tarif',
            machineUpdated: 'Machine mise à jour', machineAdded: 'Machine ajoutée',
            couldNotSaveMachine: "Impossible d'enregistrer la machine",
            confirmDeleteMachine: 'Supprimer cette machine du catalogue ?', deleteMachineConfirmTitle: 'Supprimer la machine',
            noDevicesFound: 'Aucun appareil enregistré trouvé',
            chooseADevice: 'Choisissez un appareil...',
            settingsSaved: 'Paramètres enregistrés',
            couldNotSaveSettings: "Impossible d'enregistrer les paramètres",
            matKindFilament: 'Filament', matKindSheet: 'Plaque', matKindConsumable: 'Consommable',
            machKindPrinter: 'Imprimante', machKindLaser: 'Laser', machKindCnc: 'CNC',
            pageTitleCotizador: 'Devis',
            pageSubtitle: "Calculez le coût estimé de vos travaux d'impression 3D, laser ou CNC",
            newQuoteBtn: 'Nouveau devis', moreOptionsAriaLabel: "Plus d'options",
            manageCatalogsBtn: 'Gérer les catalogues', discardDraftBtn: 'Abandonner le brouillon',
            breadcrumbStep1Title: 'Charger un fichier', breadcrumbStep1SubDefault: 'Sélectionnez un fichier', breadcrumbStep1SubDone: 'Fichier sélectionné',
            breadcrumbStep2Title: 'Configurer le travail', breadcrumbStep2Sub: 'Paramètres et matériau',
            breadcrumbStep3Title: 'Devis', breadcrumbStep3Sub: 'Révision et calcul',
            saveQuoteBtn: 'Enregistrer le devis', previewPdfBtn: 'Aperçu PDF',
            sendQuoteBtn: 'Envoyer le devis', sendWhatsappBtn: 'Envoyer via WhatsApp',
            selectedFileTitle: 'Fichier sélectionné',
            selectFileHint: 'Choisissez le type de travail dans "Configuration du travail" et sélectionnez un fichier.',
            replaceBtn: 'Remplacer',
            fileInfoTitle: 'Informations sur le fichier',
            jobConfigTitle: 'Configuration du travail',
            machineLabel: 'Machine', materialLabel: 'Matériau', colorVariantLabel: 'Couleur / Variante',
            colorNatural: 'Naturel', colorWhite: 'Blanc', colorBlack: 'Noir', colorRed: 'Rouge',
            colorGreen: 'Vert', colorBlue: 'Bleu', colorYellow: 'Jaune', colorOther: 'Autre',
            quantityLabel: 'Quantité', lessAriaLabel: 'Moins', moreAriaLabel: 'Plus',
            spoolmanSpoolLabel: 'Bobine Spoolman', optionalSuffix: '(facultatif)',
            spoolmanDefaultOption: 'Aucune bobine liée (utiliser le coût du matériau générique)',
            spoolmanNotInstalledNotice: "La consommation réelle de filament (couleurs, type et disponibilité) ne s'affiche ici que si le plugin Matériaux (Spoolman) est installé. En attendant, le coût du matériau générique est utilisé.",
            spoolmanNotConfiguredNotice: "Le plugin Matériaux (Spoolman) est installé mais pas encore connecté à un serveur -- configurez-le dans Paramètres → Plugins → Matériaux pour voir l'inventaire réel ici.",
            spoolmanCarreteFallback: 'Bobine',
            gAvailableSuffix: 'g disponibles',
            spoolmanMaterialFallback: 'Filament',
            detailLevelLabel: 'Niveau de détail',
            detailEconomic: 'Économique', detailStandard: 'Standard', detailHigh: 'Haute qualité',
            detailLevelHint: "Ajuste le temps d'impression 3D estimé (et avec lui l'électricité et l'utilisation de la machine) -- ne s'applique pas au laser/CNC.",
            notesLabel: 'Notes', notesPlaceholder: 'Notes internes ou pour le client...',
            extraCostsLabel: 'Consommables / coûts additionnels', addCostBtn: 'Ajouter un coût',
            quoteSummaryTitle: 'Résumé du devis', currencyLabel: 'Devise', exchangeRateLabel: 'Taux de change',
            subtotalLabel: 'Sous-total', marginLabel: 'Marge bénéficiaire', totalEstimatedLabel: 'TOTAL ESTIMÉ',
            additionalInfoTitle: 'Informations supplémentaires', totalEstimatedTimeLabel: 'Temps total estimé',
            quoteDateLabel: 'Date du devis', clientNameLabel: 'Nom du client', optionalPlaceholder: 'Facultatif',
            clientPhoneLabel: 'Téléphone du client', validUntilLabel: "Valable jusqu'au",
            quoteIdLabel: 'ID du devis', copyTitle: 'Copier',
            recentQuotesTitle: 'Devis récents',
            tableHeaderId: 'ID', tableHeaderFile: 'Fichier', tableHeaderType: 'Type', tableHeaderTotal: 'Total',
            tableHeaderDate: 'Date', tableHeaderStatus: 'État',
            catalogsModalTitle: 'Catalogues et paramètres de coûts',
            tabMaterials: 'Matériaux', tabMachines: 'Machines', tabSettings: 'Paramètres',
            nameLabel: 'Nom', typeLabel: 'Type',
            unitCostLabel: 'Coût unitaire', unitLabel: 'Unité',
            densityLabel: 'Densité (g/cm³)', diameterLabel: 'Diamètre (mm)',
            thicknessLabel: 'Épaisseur (mm) — référence uniquement',
            addMaterialBtn: 'Ajouter un matériau', saveChangesBtn: 'Enregistrer les modifications', cancelEditBtn: "Annuler l'édition",
            importDeviceNameLabel: "Importer le nom depuis un appareil enregistré (facultatif)",
            wattsLabel: 'Puissance (W)', rateLabel: 'Tarif ($/heure)',
            addMachineBtn: 'Ajouter une machine',
            defaultCurrencyLabel: 'Devise par défaut', priceKwhLabel: 'Prix du kWh',
            laborRateLabel: "Tarif de main-d'œuvre ($/heure)", prepMinutesLabel: 'Minutes de préparation par défaut',
            marginModeLabel: 'Mode de marge', marginModePercentage: 'Pourcentage', marginModeFlat: 'Montant fixe',
            marginPercentLabel: 'Marge (%)', marginFlatLabel: 'Marge (montant fixe)',
            whatsappTemplateLabel: 'Message WhatsApp personnalisé',
            whatsappTemplatePlaceholder: 'Bonjour {cliente} ! Voici votre devis...',
            whatsappTemplateHint: 'Espaces réservés disponibles : {cliente}, {total}, {id}, {vigencia}, {link}. Laissez vide pour utiliser le message générique.',
            saveSettingsBtn: 'Enregistrer les paramètres',
            sendWhatsappModalTitle: 'Envoyer le devis via WhatsApp',
            sendWhatsappModalHint: "Vérifiez ou modifiez le message avant d'ouvrir WhatsApp.",
            messageLabel: 'Message', sendBtn: 'Envoyer', cancelBtn: 'Annuler',
        },
        'pt-BR': {
            jobTypePrinter: 'Impressão 3D', jobTypeLaserCut: 'Corte a Laser',
            jobTypeLaserEngrave: 'Gravação a Laser', jobTypeCnc: 'CNC',
            costLineMaterial: 'Material', costLineElectricity: 'Energia',
            costLineMachineUsage: 'Uso da máquina', costLineLabor: 'Mão de obra',
            costLineConsumables: 'Consumíveis', costLineAdditional: 'Custos adicionais',
            statusDraft: 'Rascunho', statusSent: 'Enviada', statusApproved: 'Aprovada', statusRejected: 'Rejeitada',
            idCopied: 'ID copiado',
            couldNotLoadFolder: 'Não foi possível carregar a pasta',
            loadingEllipsis: 'Carregando...',
            noFilesFound: 'Nenhum arquivo encontrado.',
            couldNotCalculateQuote: 'Não foi possível calcular a cotação.',
            selectFileAndMaterial: 'Selecione um arquivo e um material para ver o custo.',
            saveQuoteFirstHint: 'Salve a cotação primeiro',
            quoteSaved: 'Cotação salva',
            couldNotSaveQuote: 'Não foi possível salvar a cotação.',
            quoteMarkedSent: 'Cotação marcada como enviada',
            couldNotUpdateQuoteStatus: 'Não foi possível atualizar o status da cotação.',
            couldNotGenerateWhatsappLink: 'Não foi possível gerar o link do WhatsApp.',
            couldNotLoadHistory: 'Não foi possível carregar o histórico',
            noQuotesSaved: 'Ainda não há cotações salvas.',
            previewPdfTitle: 'Pré-visualização do PDF', loadQuoteTitle: 'Carregar cotação', deleteQuoteTitle: 'Excluir cotação',
            quoteLoaded: 'Cotação carregada',
            couldNotLoadQuote: 'Não foi possível carregar a cotação.',
            confirmDeleteQuote: 'Excluir esta cotação?',
            quoteDeleted: 'Cotação excluída.',
            couldNotDeleteQuote: 'Não foi possível excluir a cotação.',
            noMaterialsOfType: 'Não há materiais desse tipo no catálogo',
            noSpecificMachine: 'Sem máquina específica',
            breadcrumbRootPrinting: 'Impressão 3D', breadcrumbRootLaserCnc: 'Laser / CNC',
            costDescriptionPlaceholder: 'Descrição do custo',
            costCategoryConsumable: 'Consumível', costCategoryAdditional: 'Adicional',
            removeBtn: 'Remover',
            workTypeLabel: 'Tipo de trabalho',
            estimatedTimeLabel: 'Tempo estimado', estimatedWeightLabel: 'Peso estimado',
            cutLengthLabel: 'Comprimento de corte', areaLabel: 'Área',
            widthLabel: 'Largura:', heightLabel: 'Altura:',
            preparationSupervisionDetail: 'Preparação e supervisão ({minutes} min)',
            machineUsageDetail: '{time} a ${rate}/h',
            noMaterialsInCatalog: 'Ainda não há materiais no catálogo.',
            noMachinesInCatalog: 'Ainda não há máquinas no catálogo.',
            editMaterialTitle: 'Editar material', deleteMaterialTitle: 'Excluir material',
            editMachineTitle: 'Editar máquina', deleteMachineTitle: 'Excluir máquina',
            fillNameAndUnitCost: 'Preencha o nome e o custo unitário',
            materialUpdated: 'Material atualizado', materialAdded: 'Material adicionado',
            couldNotSaveMaterial: 'Não foi possível salvar o material',
            confirmDeleteMaterial: 'Excluir este material do catálogo?', deleteMaterialConfirmTitle: 'Excluir material',
            fillNameWattsRate: 'Preencha o nome, watts e a taxa',
            machineUpdated: 'Máquina atualizada', machineAdded: 'Máquina adicionada',
            couldNotSaveMachine: 'Não foi possível salvar a máquina',
            confirmDeleteMachine: 'Excluir esta máquina do catálogo?', deleteMachineConfirmTitle: 'Excluir máquina',
            noDevicesFound: 'Nenhum dispositivo registrado encontrado',
            chooseADevice: 'Escolha um dispositivo...',
            settingsSaved: 'Configurações salvas',
            couldNotSaveSettings: 'Não foi possível salvar as configurações',
            matKindFilament: 'Filamento', matKindSheet: 'Chapa', matKindConsumable: 'Consumível',
            machKindPrinter: 'Impressora', machKindLaser: 'Laser', machKindCnc: 'CNC',
            pageTitleCotizador: 'Cotador',
            pageSubtitle: 'Calcule o custo estimado dos seus trabalhos de impressão 3D, laser ou CNC',
            newQuoteBtn: 'Nova cotação', moreOptionsAriaLabel: 'Mais opções',
            manageCatalogsBtn: 'Gerenciar catálogos', discardDraftBtn: 'Descartar rascunho',
            breadcrumbStep1Title: 'Carregar arquivo', breadcrumbStep1SubDefault: 'Selecione um arquivo', breadcrumbStep1SubDone: 'Arquivo selecionado',
            breadcrumbStep2Title: 'Configurar trabalho', breadcrumbStep2Sub: 'Parâmetros e material',
            breadcrumbStep3Title: 'Cotação', breadcrumbStep3Sub: 'Revisão e cálculo',
            saveQuoteBtn: 'Salvar cotação', previewPdfBtn: 'Pré-visualização do PDF',
            sendQuoteBtn: 'Enviar cotação', sendWhatsappBtn: 'Enviar via WhatsApp',
            selectedFileTitle: 'Arquivo selecionado',
            selectFileHint: 'Escolha o tipo de trabalho em "Configuração do trabalho" e selecione um arquivo.',
            replaceBtn: 'Substituir',
            fileInfoTitle: 'Informações do arquivo',
            jobConfigTitle: 'Configuração do trabalho',
            machineLabel: 'Máquina', materialLabel: 'Material', colorVariantLabel: 'Cor / Variante',
            colorNatural: 'Natural', colorWhite: 'Branco', colorBlack: 'Preto', colorRed: 'Vermelho',
            colorGreen: 'Verde', colorBlue: 'Azul', colorYellow: 'Amarelo', colorOther: 'Outro',
            quantityLabel: 'Quantidade', lessAriaLabel: 'Menos', moreAriaLabel: 'Mais',
            spoolmanSpoolLabel: 'Carretel do Spoolman', optionalSuffix: '(opcional)',
            spoolmanDefaultOption: 'Sem carretel vinculado (usar custo do material genérico)',
            spoolmanNotInstalledNotice: 'O consumo real de filamento (cores, tipo e disponibilidade) só aparece aqui se você tiver o plugin Materiais (Spoolman) instalado. Enquanto isso, é usado o custo do material genérico.',
            spoolmanNotConfiguredNotice: 'O plugin Materiais (Spoolman) está instalado, mas ainda não está conectado a um servidor -- configure-o em Configurações → Plugins → Materiais para ver o inventário real aqui.',
            spoolmanCarreteFallback: 'Carretel',
            gAvailableSuffix: 'g disponíveis',
            spoolmanMaterialFallback: 'Filamento',
            detailLevelLabel: 'Nível de detalhe',
            detailEconomic: 'Econômico', detailStandard: 'Padrão', detailHigh: 'Alta qualidade',
            detailLevelHint: 'Ajusta o tempo estimado de impressão 3D (e com isso energia e uso da máquina) -- não se aplica a laser/CNC.',
            notesLabel: 'Notas', notesPlaceholder: 'Notas internas ou para o cliente...',
            extraCostsLabel: 'Consumíveis / custos adicionais', addCostBtn: 'Adicionar custo',
            quoteSummaryTitle: 'Resumo da cotação', currencyLabel: 'Moeda', exchangeRateLabel: 'Taxa de câmbio',
            subtotalLabel: 'Subtotal', marginLabel: 'Margem de lucro', totalEstimatedLabel: 'TOTAL ESTIMADO',
            additionalInfoTitle: 'Informações adicionais', totalEstimatedTimeLabel: 'Tempo total estimado',
            quoteDateLabel: 'Data da cotação', clientNameLabel: 'Nome do cliente', optionalPlaceholder: 'Opcional',
            clientPhoneLabel: 'Telefone do cliente', validUntilLabel: 'Válido até',
            quoteIdLabel: 'ID da cotação', copyTitle: 'Copiar',
            recentQuotesTitle: 'Cotações recentes',
            tableHeaderId: 'ID', tableHeaderFile: 'Arquivo', tableHeaderType: 'Tipo', tableHeaderTotal: 'Total',
            tableHeaderDate: 'Data', tableHeaderStatus: 'Status',
            catalogsModalTitle: 'Catálogos e configurações de custos',
            tabMaterials: 'Materiais', tabMachines: 'Máquinas', tabSettings: 'Configurações',
            nameLabel: 'Nome', typeLabel: 'Tipo',
            unitCostLabel: 'Custo unitário', unitLabel: 'Unidade',
            densityLabel: 'Densidade (g/cm³)', diameterLabel: 'Diâmetro (mm)',
            thicknessLabel: 'Espessura (mm) — apenas referência',
            addMaterialBtn: 'Adicionar material', saveChangesBtn: 'Salvar alterações', cancelEditBtn: 'Cancelar edição',
            importDeviceNameLabel: 'Importar nome de um dispositivo registrado (opcional)',
            wattsLabel: 'Potência (W)', rateLabel: 'Taxa ($/hora)',
            addMachineBtn: 'Adicionar máquina',
            defaultCurrencyLabel: 'Moeda padrão', priceKwhLabel: 'Preço do kWh',
            laborRateLabel: 'Taxa de mão de obra ($/hora)', prepMinutesLabel: 'Minutos de preparação padrão',
            marginModeLabel: 'Modo de margem', marginModePercentage: 'Porcentagem', marginModeFlat: 'Valor fixo',
            marginPercentLabel: 'Margem (%)', marginFlatLabel: 'Margem (valor fixo)',
            whatsappTemplateLabel: 'Mensagem pessoal do WhatsApp',
            whatsappTemplatePlaceholder: 'Olá {cliente}! Aqui está sua cotação...',
            whatsappTemplateHint: 'Placeholders disponíveis: {cliente}, {total}, {id}, {vigencia}, {link}. Deixe em branco para usar a mensagem genérica.',
            saveSettingsBtn: 'Salvar configurações',
            sendWhatsappModalTitle: 'Enviar cotação via WhatsApp',
            sendWhatsappModalHint: 'Revise ou edite a mensagem antes de abrir o WhatsApp.',
            messageLabel: 'Mensagem', sendBtn: 'Enviar', cancelBtn: 'Cancelar',
        },
    };

    function lang() {
        let value = document.documentElement.lang || localStorage.getItem('language') || 'es';
        value = String(value).toLowerCase();
        if (value.startsWith('pt')) return 'pt-BR';
        if (I18N[value]) return value;
        return 'en';
    }

    function tr(key, vars) {
        const dict = I18N[lang()] || I18N.en;
        let text = dict[key] ?? I18N.en[key] ?? key;
        if (vars) {
            Object.entries(vars).forEach(([name, value]) => {
                text = text.replace(`{${name}}`, value);
            });
        }
        return text;
    }

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
        get printer() { return tr('jobTypePrinter'); },
        get laser_cut() { return tr('jobTypeLaserCut'); },
        get laser_engrave() { return tr('jobTypeLaserEngrave'); },
        get cnc() { return tr('jobTypeCnc'); },
    };

    const PRICING_COST_LINE_LABELS = {
        get material() { return tr('costLineMaterial'); },
        get electricity() { return tr('costLineElectricity'); },
        get machine_usage() { return tr('costLineMachineUsage'); },
        get labor() { return tr('costLineLabor'); },
        get consumables() { return tr('costLineConsumables'); },
        get additional() { return tr('costLineAdditional'); },
    };

    const PRICING_STATUS_LABELS = {
        get draft() { return tr('statusDraft'); },
        get sent() { return tr('statusSent'); },
        get approved() { return tr('statusApproved'); },
        get rejected() { return tr('statusRejected'); },
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

        if (sub1) sub1.textContent = hasFile ? tr('breadcrumbStep1SubDone') : tr('breadcrumbStep1SubDefault');
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
            .then(() => toast(tr('idCopied')))
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
            notice.textContent = tr('spoolmanNotInstalledNotice');
            renderSpoolmanSpoolInfo();
            return;
        }
        if (!spoolmanConfigured) {
            select.hidden = true;
            notice.hidden = false;
            notice.textContent = tr('spoolmanNotConfiguredNotice');
            renderSpoolmanSpoolInfo();
            return;
        }

        select.hidden = false;
        notice.hidden = true;

        const prevValue = pricingLinkedSpoolId;
        const options = spoolmanSpools.map(spool => {
            const filament = spool.filament || {};
            const available = Math.round(spool.available_weight ?? spool.remaining_weight ?? 0);
            const label = [filament.material, filament.name].filter(Boolean).join(' ') || tr('spoolmanCarreteFallback');
            return `<option value="${esc(String(spool.id))}">${esc(label)} — ${available} ${esc(tr('gAvailableSuffix'))}</option>`;
        }).join('');
        select.innerHTML = `<option value="">${esc(tr('spoolmanDefaultOption'))}</option>${options}`;
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
            <span>${esc(filament.material || tr('spoolmanMaterialFallback'))}${filament.name ? ' · ' + esc(filament.name) : ''}</span>
            <strong>${available} ${esc(tr('gAvailableSuffix'))}</strong>
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
            : `<option value="">${esc(tr('noMaterialsOfType'))}</option>`;
        if (relevant.some(m => m.id === prevValue)) select.value = prevValue;
    }

    function renderPricingMachineSelect() {
        const select = document.getElementById('pricing-machine-select');
        if (!select) return;
        const wantKind = PRICING_JOB_TYPE_MAP[pricingJobType].machineKind;
        const relevant = pricingMachines.filter(m => m.kind === wantKind);
        const prevValue = select.value;
        select.innerHTML = `<option value="">${esc(tr('noSpecificMachine'))}</option>` +
            relevant.map(m => `<option value="${esc(m.id)}">${esc(m.name)}</option>`).join('');
        if (relevant.some(m => m.id === prevValue)) select.value = prevValue;
    }

    async function loadPricingFileBrowser(path) {
        pricingBrowsePath = path;
        const container = document.getElementById('pricing-file-browser');
        if (container) container.innerHTML = `<div class="empty-state-small">${esc(tr('loadingEllipsis'))}</div>`;
        try {
            const response = await fetch(`/api/browse?path=${encodeURIComponent(path)}&type=${encodeURIComponent(pricingSection())}`);
            if (!response.ok) throw new Error(tr('couldNotLoadFolder'));
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
        const rootLabel = pricingSection() === 'model' ? tr('breadcrumbRootPrinting') : tr('breadcrumbRootLaserCnc');
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
            container.innerHTML = `<div class="empty-state-small">${esc(tr('noFilesFound'))}</div>`;
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
                <input type="text" class="pricing-extra-cost-label" placeholder="${esc(tr('costDescriptionPlaceholder'))}" value="${esc(cost.label)}">
                <input type="number" class="pricing-extra-cost-amount" min="0" step="0.01" value="${cost.amount}">
                <select class="pricing-extra-cost-category">
                    <option value="consumable"${cost.category === 'consumable' ? ' selected' : ''}>${esc(tr('costCategoryConsumable'))}</option>
                    <option value="additional"${cost.category === 'additional' ? ' selected' : ''}>${esc(tr('costCategoryAdditional'))}</option>
                </select>
                <button type="button" class="pricing-extra-cost-remove-btn" title="${esc(tr('removeBtn'))}">
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
                throw new Error(data.detail || tr('couldNotCalculateQuote'));
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
            linesContainer.innerHTML = `<div class="empty-state-small">${errorMessage ? esc(errorMessage) : esc(tr('selectFileAndMaterial'))}</div>`;
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
                localizedDetail = tr('machineUsageDetail', { time: _formatMinutes(result.extracted.estimated_time_minutes), rate });
            } else if (line.key === 'labor') {
                const minutes = String(line.detail || '').match(/[\d.,]+/)?.[0] || '0';
                localizedDetail = tr('preparationSupervisionDetail', { minutes });
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
            btn.title = enabled ? '' : tr('saveQuoteFirstHint');
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
        const rows = [[tr('workTypeLabel'), pricingJobTypeLabel(pricingJobType), 'pill']];
        if (e.estimated_time_minutes != null) rows.push([tr('estimatedTimeLabel'), _formatMinutes(e.estimated_time_minutes)]);
        if (e.filament_g != null) rows.push([tr('estimatedWeightLabel'), `${e.filament_g.toFixed(2)} g`]);
        if (e.cut_length_mm != null) rows.push([tr('cutLengthLabel'), `${(e.cut_length_mm / 1000).toFixed(2)} m`]);
        if (e.bounding_box_area_m2 != null) rows.push([tr('areaLabel'), `${e.bounding_box_area_m2.toFixed(3)} m²`]);

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
                    <span>${esc(tr('widthLabel'))} <strong>${e.width_mm.toFixed(1)} mm</strong></span>
                    <span>${esc(tr('heightLabel'))} <strong>${e.height_mm.toFixed(1)} mm</strong></span>
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
            if (!response.ok) throw new Error(tr('couldNotSaveQuote'));
            const saved = await response.json();
            pricingLastSavedQuoteId = saved.id;
            pricingLastLoadedQuoteId = saved.id;
            toast(`${tr('quoteSaved')}: ${saved.id}`);
            updatePricingSaveGatedButtons();
            renderPricingAdditionalInfo(pricingLastQuoteResult);
            loadPricingQuotesHistory();
        } catch (error) {
            console.error(error);
            alertDialog(error.message || tr('couldNotSaveQuote'), '', 'danger');
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
            if (!response.ok) throw new Error(tr('couldNotUpdateQuoteStatus'));
            toast(tr('quoteMarkedSent'));
            loadPricingQuotesHistory();
        } catch (error) {
            console.error(error);
            alertDialog(error.message || tr('couldNotUpdateQuoteStatus'), '', 'danger');
        }
    }

    async function openPricingWhatsappModal(quoteId) {
        const id = quoteId || pricingLastSavedQuoteId;
        if (!id) return;
        try {
            const response = await fetch(`/api/pricing/quotes/${encodeURIComponent(id)}/whatsapp-link`);
            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.detail || tr('couldNotGenerateWhatsappLink'));
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
            alertDialog(error.message || tr('couldNotGenerateWhatsappLink'), '', 'danger');
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
                throw new Error(data.detail || tr('couldNotGenerateWhatsappLink'));
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
            alertDialog(error.message || tr('couldNotGenerateWhatsappLink'), '', 'danger');
        }
    }

    async function loadPricingQuotesHistory() {
        try {
            const response = await fetch('/api/pricing/quotes');
            if (!response.ok) throw new Error(tr('couldNotLoadHistory'));
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
            tbody.innerHTML = `<tr><td colspan="7" class="empty-state">${esc(tr('noQuotesSaved'))}</td></tr>`;
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
                        <button type="button" class="pricing-quote-print-btn" data-id="${esc(quote.id)}" title="${esc(tr('previewPdfTitle'))}">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                        </button>
                        <button type="button" class="pricing-quote-load-btn" data-id="${esc(quote.id)}" title="${esc(tr('loadQuoteTitle'))}">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 17l5-5-5-5"/><path d="M5 12h14"/></svg>
                        </button>
                        <button type="button" class="pricing-quote-delete-btn" data-id="${esc(quote.id)}" title="${esc(tr('deleteQuoteTitle'))}">
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
            if (!response.ok) throw new Error(tr('couldNotLoadQuote'));
            const quote = await response.json();
            fillPricingQuoteWizard(quote);
            toast(`${tr('quoteLoaded')}: ${quote.id}`);
        } catch (error) {
            console.error(error);
            alertDialog(error.message || tr('couldNotLoadQuote'), '', 'danger');
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
        if (!quoteId || !window.confirm(tr('confirmDeleteQuote'))) return;
        try {
            const response = await fetch(`/api/pricing/quotes/${encodeURIComponent(quoteId)}`, { method: 'DELETE' });
            if (!response.ok) throw new Error(tr('couldNotDeleteQuote'));
            toast(tr('quoteDeleted'));
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
            alertDialog(error.message || tr('couldNotDeleteQuote'), '', 'danger');
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
        if (kind === 'filament') return tr('matKindFilament');
        if (kind === 'sheet') return tr('matKindSheet');
        return tr('matKindConsumable');
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
        if (addBtn) addBtn.querySelector('span').textContent = tr('addMaterialBtn');
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
        if (addBtn) addBtn.querySelector('span').textContent = tr('saveChangesBtn');
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
            container.innerHTML = `<div class="empty-state-small">${esc(tr('noMaterialsInCatalog'))}</div>`;
            return;
        }
        container.innerHTML = materials.map(material => `
            <div class="usb-port-item" data-id="${esc(material.id)}">
                <div class="usb-port-item-info">
                    <strong>${esc(material.name)}</strong>
                    <span>${esc(pricingMaterialKindLabel(material.kind))} · ${material.unit_cost}/${esc(material.unit || '')}</span>
                </div>
                <div class="pricing-catalog-item-actions">
                    <button type="button" class="theme-option-icon-btn material-edit-btn" data-id="${esc(material.id)}" title="${esc(tr('editMaterialTitle'))}">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                    </button>
                    <button type="button" class="theme-option-icon-btn theme-option-icon-btn-danger material-remove-btn" data-id="${esc(material.id)}" title="${esc(tr('deleteMaterialTitle'))}">
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
                errorEl.textContent = tr('fillNameAndUnitCost');
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
                throw new Error(data.detail || tr('couldNotSaveMaterial'));
            }
            toast(pricingMaterialEditingId ? tr('materialUpdated') : tr('materialAdded'));
            resetPricingMaterialForm();
            loadPricingMaterialsCatalog();
            loadPricingCatalogs();
        } catch (error) {
            console.error(error);
            if (errorEl) {
                errorEl.textContent = error.message || tr('couldNotSaveMaterial');
                errorEl.hidden = false;
            }
        }
    }

    async function removePricingMaterialCatalogEntry(id) {
        if (!(await confirmDialog(tr('confirmDeleteMaterial'), tr('deleteMaterialConfirmTitle')))) return;
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
            alertDialog(tr('couldNotSaveMaterial'), '', 'danger');
        }
    }


    // ── Máquinas ──


    function pricingMachineKindLabel(kind) {
        if (kind === 'printer') return tr('machKindPrinter');
        if (kind === 'laser') return tr('machKindLaser');
        return tr('machKindCnc');
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
        if (addBtn) addBtn.querySelector('span').textContent = tr('addMachineBtn');
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
        if (addBtn) addBtn.querySelector('span').textContent = tr('saveChangesBtn');
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
            container.innerHTML = `<div class="empty-state-small">${esc(tr('noMachinesInCatalog'))}</div>`;
            return;
        }
        container.innerHTML = machines.map(machine => `
            <div class="usb-port-item" data-id="${esc(machine.id)}">
                <div class="usb-port-item-info">
                    <strong>${esc(machine.name)}</strong>
                    <span>${esc(pricingMachineKindLabel(machine.kind))} · ${machine.watts}W · $${machine.rate_per_hour}/h</span>
                </div>
                <div class="pricing-catalog-item-actions">
                    <button type="button" class="theme-option-icon-btn machine-edit-btn" data-id="${esc(machine.id)}" title="${esc(tr('editMachineTitle'))}">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                    </button>
                    <button type="button" class="theme-option-icon-btn theme-option-icon-btn-danger machine-remove-btn" data-id="${esc(machine.id)}" title="${esc(tr('deleteMachineTitle'))}">
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
                errorEl.textContent = tr('fillNameWattsRate');
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
                throw new Error(data.detail || tr('couldNotSaveMachine'));
            }
            toast(pricingMachineEditingId ? tr('machineUpdated') : tr('machineAdded'));
            resetPricingMachineForm();
            loadPricingMachinesCatalog();
            loadPricingCatalogs();
        } catch (error) {
            console.error(error);
            if (errorEl) {
                errorEl.textContent = error.message || tr('couldNotSaveMachine');
                errorEl.hidden = false;
            }
        }
    }

    async function removePricingMachineCatalogEntry(id) {
        if (!(await confirmDialog(tr('confirmDeleteMachine'), tr('deleteMachineConfirmTitle')))) return;
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
            alertDialog(tr('couldNotSaveMachine'), '', 'danger');
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
            select.innerHTML = `<option value="" disabled selected>${esc(tr('noDevicesFound'))}</option>`;
            return;
        }

        select.innerHTML = `<option value="" disabled selected>${esc(tr('chooseADevice'))}</option>` +
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
            toast(tr('settingsSaved'));
            schedulePricingQuoteRefresh();
        } catch (error) {
            console.error(error);
            if (errorEl) {
                errorEl.textContent = tr('couldNotSaveSettings');
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
                                <h1>${tr('pageTitleCotizador')}</h1>
                                <p>${tr('pageSubtitle')}</p>
                            </div>
                        </div>
                        <div class="pricing-header-bar-actions">
                            <button type="button" class="btn-file-action" id="pricing-new-quote-btn">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                                <span>${tr('newQuoteBtn')}</span>
                            </button>
                            <div class="topbar-notif-wrap" id="pricing-header-menu-wrap">
                                <button type="button" class="topbar-icon-btn" id="pricing-header-menu-btn" aria-label="${tr('moreOptionsAriaLabel')}">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>
                                </button>
                                <div class="topbar-menu-panel" id="pricing-header-menu-panel" hidden>
                                    <button type="button" class="topbar-menu-item" id="pricing-manage-catalogs-btn">
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                                        <span>${tr('manageCatalogsBtn')}</span>
                                    </button>
                                    <button type="button" class="topbar-menu-item topbar-menu-item-danger" id="pricing-discard-btn">
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                        <span>${tr('discardDraftBtn')}</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="pricing-steps-breadcrumb" id="pricing-steps-breadcrumb">
                        <div class="pricing-breadcrumb-step" id="pricing-breadcrumb-step-1">
                            <span class="pricing-breadcrumb-num">1</span>
                            <span class="pricing-breadcrumb-labels">
                                <strong>${tr('breadcrumbStep1Title')}</strong>
                                <small id="pricing-breadcrumb-sub-1">${tr('breadcrumbStep1SubDefault')}</small>
                            </span>
                        </div>
                        <svg class="pricing-breadcrumb-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
                        <div class="pricing-breadcrumb-step" id="pricing-breadcrumb-step-2">
                            <span class="pricing-breadcrumb-num">2</span>
                            <span class="pricing-breadcrumb-labels">
                                <strong>${tr('breadcrumbStep2Title')}</strong>
                                <small>${tr('breadcrumbStep2Sub')}</small>
                            </span>
                        </div>
                        <svg class="pricing-breadcrumb-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
                        <div class="pricing-breadcrumb-step" id="pricing-breadcrumb-step-3">
                            <span class="pricing-breadcrumb-num">3</span>
                            <span class="pricing-breadcrumb-labels">
                                <strong>${tr('breadcrumbStep3Title')}</strong>
                                <small>${tr('breadcrumbStep3Sub')}</small>
                            </span>
                        </div>

                        <div class="pricing-breadcrumb-actions" id="pricing-breadcrumb-actions">
                            <button type="button" class="btn-file-action-accent" id="pricing-save-btn" disabled>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                                <span>${tr('saveQuoteBtn')}</span>
                            </button>
                            <button type="button" class="btn-file-action-decision" id="pricing-print-btn" disabled title="${tr('saveQuoteFirstHint')}">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                                <span>${tr('previewPdfBtn')}</span>
                            </button>
                            <button type="button" class="btn-file-action" id="pricing-send-btn" disabled title="${tr('saveQuoteFirstHint')}">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                                <span>${tr('sendQuoteBtn')}</span>
                            </button>
                            <button type="button" class="btn-file-action" id="pricing-whatsapp-btn" disabled title="${tr('saveQuoteFirstHint')}">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                                <span>${tr('sendWhatsappBtn')}</span>
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
                                    <span class="card-header-std-title">${tr('selectedFileTitle')}</span>
                                </div>
                                <div id="pricing-file-empty">
                                    <p class="pricing-file-empty-hint">${tr('selectFileHint')}</p>
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
                                        <button type="button" class="pricing-replace-btn" id="pricing-replace-file-btn">${tr('replaceBtn')}</button>
                                    </div>
                                    <div class="pricing-selected-file-thumb" id="pricing-selected-file-thumb"></div>
                                    <div class="pricing-selected-file-dims" id="pricing-selected-file-dims" hidden></div>
                                </div>
                            </div>
                            <div class="pricing-card" id="pricing-file-info-card" hidden>
                                <div class="card-header-std">
                                    <span class="card-header-std-title">${tr('fileInfoTitle')}</span>
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
                                    <span class="card-header-std-title">${tr('jobConfigTitle')}</span>
                                </div>
                                <label class="pricing-label">${tr('workTypeLabel')}</label>
                                <div class="option-switch pricing-job-type-switch" id="pricing-job-type-switch">
                                    <button type="button" class="option-switch-btn active" data-value="printer">${tr('jobTypePrinter')}</button>
                                    <button type="button" class="option-switch-btn" data-value="laser_cut">${tr('jobTypeLaserCut')}</button>
                                    <button type="button" class="option-switch-btn" data-value="laser_engrave">${tr('jobTypeLaserEngrave')}</button>
                                    <button type="button" class="option-switch-btn" data-value="cnc">${tr('jobTypeCnc')}</button>
                                </div>
                                <div class="pricing-form-grid">
                                    <div class="pricing-field">
                                        <label>${tr('machineLabel')}</label>
                                        <select id="pricing-machine-select"></select>
                                    </div>
                                    <div class="pricing-field">
                                        <label>${tr('materialLabel')}</label>
                                        <select id="pricing-material-select"></select>
                                    </div>
                                    <div class="pricing-field">
                                        <label>${tr('colorVariantLabel')}</label>
                                        <select id="pricing-color-select">
                                            <option value="">${tr('colorNatural')}</option>
                                            <option value="blanco">${tr('colorWhite')}</option>
                                            <option value="negro">${tr('colorBlack')}</option>
                                            <option value="rojo">${tr('colorRed')}</option>
                                            <option value="verde">${tr('colorGreen')}</option>
                                            <option value="azul">${tr('colorBlue')}</option>
                                            <option value="amarillo">${tr('colorYellow')}</option>
                                            <option value="otro">${tr('colorOther')}</option>
                                        </select>
                                    </div>
                                    <div class="pricing-field">
                                        <label>${tr('quantityLabel')}</label>
                                        <div class="pricing-qty-stepper">
                                            <button type="button" id="pricing-qty-minus" aria-label="${tr('lessAriaLabel')}">−</button>
                                            <input type="number" id="pricing-quantity-input" min="1" step="1" value="1">
                                            <button type="button" id="pricing-qty-plus" aria-label="${tr('moreAriaLabel')}">+</button>
                                        </div>
                                    </div>
                                </div>
                                <div class="pricing-field pricing-field-wide" id="pricing-spoolman-field" hidden>
                                    <label>${tr('spoolmanSpoolLabel')} <span class="pricing-spoolman-optional">${tr('optionalSuffix')}</span></label>
                                    <select id="pricing-spoolman-select">
                                        <option value="">${tr('spoolmanDefaultOption')}</option>
                                    </select>
                                    <div class="pricing-spoolman-info" id="pricing-spoolman-info" hidden></div>
                                    <p class="pricing-spoolman-notice" id="pricing-spoolman-notice" hidden></p>
                                </div>
                                <label class="pricing-label">${tr('detailLevelLabel')}</label>
                                <div class="option-switch" id="pricing-detail-level-switch">
                                    <button type="button" class="option-switch-btn" data-value="economic">${tr('detailEconomic')}</button>
                                    <button type="button" class="option-switch-btn active" data-value="standard">${tr('detailStandard')}</button>
                                    <button type="button" class="option-switch-btn" data-value="high">${tr('detailHigh')}</button>
                                </div>
                                <p class="pricing-file-empty-hint">${tr('detailLevelHint')}</p>
                                <div class="pricing-field pricing-field-wide">
                                    <label>${tr('notesLabel')}</label>
                                    <textarea id="pricing-notes-input" rows="2" placeholder="${tr('notesPlaceholder')}"></textarea>
                                </div>
                                <div class="pricing-field pricing-field-wide">
                                    <label>${tr('extraCostsLabel')}</label>
                                    <div class="pricing-extra-costs-list" id="pricing-extra-costs-list"></div>
                                    <button type="button" class="btn-file-action" id="pricing-add-extra-cost-btn">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                                        <span>${tr('addCostBtn')}</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        <aside class="pricing-col pricing-col-summary">
                            <div class="pricing-card">
                                <div class="card-header-std">
                                    <span class="card-header-std-title">${tr('quoteSummaryTitle')}</span>
                                </div>
                                <div class="pricing-form-grid">
                                    <div class="pricing-field">
                                        <label>${tr('currencyLabel')}</label>
                                        <select id="pricing-currency-select">
                                            <option value="MXN">MXN ($)</option>
                                            <option value="USD">USD ($)</option>
                                            <option value="EUR">EUR (€)</option>
                                        </select>
                                    </div>
                                    <div class="pricing-field">
                                        <label>${tr('exchangeRateLabel')}</label>
                                        <input type="number" id="pricing-exchange-rate-input" value="1.0000" step="0.0001" min="0.0001">
                                    </div>
                                </div>
                                <div class="pricing-cost-lines" id="pricing-cost-lines">
                                    <div class="empty-state-small">${tr('selectFileAndMaterial')}</div>
                                </div>
                                <div class="pricing-cost-subtotal-row" id="pricing-cost-subtotal-row" hidden>
                                    <span>${tr('subtotalLabel')}</span>
                                    <span id="pricing-cost-subtotal-amount">—</span>
                                </div>
                                <div class="pricing-cost-margin-row" id="pricing-cost-margin-row" hidden>
                                    <span><span>${tr('marginLabel')}</span> <span class="pricing-margin-pill" id="pricing-margin-pill"></span></span>
                                    <span id="pricing-cost-margin-amount">—</span>
                                </div>
                                <div class="pricing-cost-total-row" id="pricing-cost-total-row" hidden>
                                    <span>${tr('totalEstimatedLabel')}</span>
                                    <span id="pricing-cost-total-amount">—</span>
                                </div>
                            </div>

                            <div class="pricing-card" id="pricing-additional-info-card">
                                <div class="card-header-std">
                                    <span class="card-header-std-title">${tr('additionalInfoTitle')}</span>
                                </div>
                                <div class="pricing-info-list" id="pricing-additional-info-list">
                                    <div class="pricing-info-row">
                                        <span>${tr('totalEstimatedTimeLabel')}</span>
                                        <strong id="pricing-info-total-time">—</strong>
                                    </div>
                                    <div class="pricing-info-row">
                                        <span>${tr('quoteDateLabel')}</span>
                                        <strong id="pricing-info-quote-date">—</strong>
                                    </div>
                                    <div class="pricing-info-row">
                                        <span>${tr('clientNameLabel')}</span>
                                        <input type="text" id="pricing-client-name-input" class="pricing-info-inline-input" autocomplete="off" placeholder="${tr('optionalPlaceholder')}">
                                    </div>
                                    <div class="pricing-info-row">
                                        <span>${tr('clientPhoneLabel')}</span>
                                        <input type="tel" id="pricing-client-phone-input" class="pricing-info-inline-input" autocomplete="off" placeholder="+52 55 1234 5678">
                                    </div>
                                    <div class="pricing-info-row">
                                        <span>${tr('validUntilLabel')}</span>
                                        <input type="date" id="pricing-valid-until-input" class="pricing-info-inline-input">
                                    </div>
                                    <div class="pricing-info-row">
                                        <span>${tr('quoteIdLabel')}</span>
                                        <span class="pricing-info-id-row">
                                            <strong id="pricing-info-quote-id">—</strong>
                                            <button type="button" id="pricing-copy-id-btn" title="${tr('copyTitle')}" hidden>
                                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                                            </button>
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </aside>

                        <div class="recent-section pricing-recent-section">
                            <div class="section-title">
                                <h2>${tr('recentQuotesTitle')}</h2>
                            </div>
                            <div class="models-table-wrapper">
                                <table class="models-table" id="pricing-quotes-table">
                                    <thead>
                                        <tr>
                                            <th>${tr('tableHeaderId')}</th>
                                            <th>${tr('tableHeaderFile')}</th>
                                            <th>${tr('tableHeaderType')}</th>
                                            <th>${tr('tableHeaderTotal')}</th>
                                            <th>${tr('tableHeaderDate')}</th>
                                            <th>${tr('tableHeaderStatus')}</th>
                                            <th></th>
                                        </tr>
                                    </thead>
                                    <tbody id="pricing-quotes-tbody">
                                        <tr><td colspan="7" class="empty-state">${tr('noQuotesSaved')}</td></tr>
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
            <h2>${tr('catalogsModalTitle')}</h2>

            <div class="option-switch" id="pricing-catalogs-tab-switch">
                <button type="button" class="option-switch-btn active" data-value="materials">${tr('tabMaterials')}</button>
                <button type="button" class="option-switch-btn" data-value="machines">${tr('tabMachines')}</button>
                <button type="button" class="option-switch-btn" data-value="settings">${tr('tabSettings')}</button>
            </div>

            <!-- Pestaña: Materiales -->
            <div id="pricing-catalogs-tab-materials" class="pricing-catalogs-tab">
                <div class="usb-ports-list" id="pricing-materials-catalog-list"></div>
                <div class="usb-classify-name-field">
                    <label>${tr('nameLabel')}</label>
                    <input type="text" id="material-add-name-input" autocomplete="off">
                </div>
                <div class="usb-classify-name-field">
                    <label>${tr('typeLabel')}</label>
                    <div class="option-switch" id="material-add-kind-switch">
                        <button type="button" class="option-switch-btn active" data-value="filament">${tr('matKindFilament')}</button>
                        <button type="button" class="option-switch-btn" data-value="sheet">${tr('matKindSheet')}</button>
                        <button type="button" class="option-switch-btn" data-value="consumable">${tr('matKindConsumable')}</button>
                    </div>
                </div>
                <div class="usb-classify-scan-grid">
                    <div class="usb-classify-name-field">
                        <label>${tr('unitCostLabel')}</label>
                        <input type="number" step="any" min="0" id="material-add-unit-cost-input">
                    </div>
                    <div class="usb-classify-name-field">
                        <label>${tr('unitLabel')}</label>
                        <select id="material-add-unit-select"></select>
                    </div>
                </div>
                <div id="material-add-extra-filament" class="usb-classify-scan-grid">
                    <div class="usb-classify-name-field">
                        <label>${tr('densityLabel')}</label>
                        <input type="number" step="any" min="0" id="material-add-density-input" value="1.24">
                    </div>
                    <div class="usb-classify-name-field">
                        <label>${tr('diameterLabel')}</label>
                        <input type="number" step="any" min="0" id="material-add-diameter-input" value="1.75">
                    </div>
                </div>
                <div id="material-add-extra-sheet" class="usb-classify-name-field" hidden>
                    <label>${tr('thicknessLabel')}</label>
                    <input type="number" step="any" min="0" id="material-add-thickness-input">
                </div>
                <div class="login-error" id="material-add-error" hidden></div>
                <div class="usb-classify-name-actions">
                    <button type="button" class="btn-file-action" id="material-add-btn">
                        <span>${tr('addMaterialBtn')}</span>
                    </button>
                    <button type="button" class="btn-file-action btn-file-action-danger" id="material-add-cancel-edit-btn" hidden>
                        <span>${tr('cancelEditBtn')}</span>
                    </button>
                </div>
            </div>

            <!-- Pestaña: Máquinas -->
            <div id="pricing-catalogs-tab-machines" class="pricing-catalogs-tab" hidden>
                <div class="usb-ports-list" id="pricing-machines-catalog-list"></div>
                <div class="usb-classify-name-field">
                    <label>${tr('importDeviceNameLabel')}</label>
                    <select id="machine-import-device-select"></select>
                </div>
                <div class="usb-classify-name-field">
                    <label>${tr('nameLabel')}</label>
                    <input type="text" id="machine-add-name-input" autocomplete="off">
                </div>
                <div class="usb-classify-name-field">
                    <label>${tr('typeLabel')}</label>
                    <div class="option-switch" id="machine-add-kind-switch">
                        <button type="button" class="option-switch-btn active" data-value="printer">${tr('machKindPrinter')}</button>
                        <button type="button" class="option-switch-btn" data-value="laser">${tr('machKindLaser')}</button>
                        <button type="button" class="option-switch-btn" data-value="cnc">${tr('machKindCnc')}</button>
                    </div>
                </div>
                <div class="usb-classify-scan-grid">
                    <div class="usb-classify-name-field">
                        <label>${tr('wattsLabel')}</label>
                        <input type="number" step="any" min="0" id="machine-add-watts-input">
                    </div>
                    <div class="usb-classify-name-field">
                        <label>${tr('rateLabel')}</label>
                        <input type="number" step="any" min="0" id="machine-add-rate-input">
                    </div>
                </div>
                <div class="login-error" id="machine-add-error" hidden></div>
                <div class="usb-classify-name-actions">
                    <button type="button" class="btn-file-action" id="machine-add-btn">
                        <span>${tr('addMachineBtn')}</span>
                    </button>
                    <button type="button" class="btn-file-action btn-file-action-danger" id="machine-add-cancel-edit-btn" hidden>
                        <span>${tr('cancelEditBtn')}</span>
                    </button>
                </div>
            </div>

            <!-- Pestaña: Ajustes globales -->
            <div id="pricing-catalogs-tab-settings" class="pricing-catalogs-tab" hidden>
                <div class="pricing-form-grid">
                    <div class="pricing-field">
                        <label>${tr('defaultCurrencyLabel')}</label>
                        <select id="settings-currency-select">
                            <option value="MXN">MXN ($)</option>
                            <option value="USD">USD ($)</option>
                            <option value="EUR">EUR (€)</option>
                        </select>
                    </div>
                    <div class="pricing-field">
                        <label>${tr('priceKwhLabel')}</label>
                        <input type="number" step="any" min="0" id="settings-price-kwh-input">
                    </div>
                    <div class="pricing-field">
                        <label>${tr('laborRateLabel')}</label>
                        <input type="number" step="any" min="0" id="settings-labor-rate-input">
                    </div>
                    <div class="pricing-field">
                        <label>${tr('prepMinutesLabel')}</label>
                        <input type="number" step="any" min="0" id="settings-prep-minutes-input">
                    </div>
                </div>
                <div class="usb-classify-name-field">
                    <label>${tr('marginModeLabel')}</label>
                    <div class="option-switch" id="settings-margin-mode-switch">
                        <button type="button" class="option-switch-btn active" data-value="percentage">${tr('marginModePercentage')}</button>
                        <button type="button" class="option-switch-btn" data-value="flat_amount">${tr('marginModeFlat')}</button>
                    </div>
                </div>
                <div class="pricing-form-grid">
                    <div class="pricing-field" id="settings-margin-percentage-field">
                        <label>${tr('marginPercentLabel')}</label>
                        <input type="number" step="any" min="0" id="settings-margin-percentage-input">
                    </div>
                    <div class="pricing-field" id="settings-margin-flat-field" hidden>
                        <label>${tr('marginFlatLabel')}</label>
                        <input type="number" step="any" min="0" id="settings-margin-flat-input">
                    </div>
                </div>
                <div class="pricing-field pricing-field-wide">
                    <label>${tr('whatsappTemplateLabel')}</label>
                    <textarea id="settings-whatsapp-template-input" rows="4" placeholder="${tr('whatsappTemplatePlaceholder')}"></textarea>
                    <p class="pricing-file-empty-hint">${tr('whatsappTemplateHint')}</p>
                </div>
                <div class="login-error" id="settings-save-error" hidden></div>
                <button type="button" class="btn-file-action" id="settings-save-btn-catalogs">
                    <span>${tr('saveSettingsBtn')}</span>
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
            <h2>${tr('sendWhatsappModalTitle')}</h2>
            <p>${tr('sendWhatsappModalHint')}</p>
            <div class="usb-classify-name-field">
                <label for="pricing-whatsapp-message-input">${tr('messageLabel')}</label>
                <textarea id="pricing-whatsapp-message-input" rows="7"></textarea>
            </div>
            <div class="usb-classify-name-actions">
                <button type="button" class="btn-file-action" id="pricing-whatsapp-confirm-btn">
                    <span>${tr('sendBtn')}</span>
                </button>
                <button type="button" class="btn-file-action btn-file-action-danger" id="pricing-whatsapp-cancel-btn">
                    <span>${tr('cancelBtn')}</span>
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
        navButton.title = tr('pageTitleCotizador');
        navButton.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg><span>${esc(tr('pageTitleCotizador'))}</span>`;
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
    window.NopalPluginRegistry[PLUGIN_ID] = { mount, unmount, version: PLUGIN_VERSION };
    mount();
})();
