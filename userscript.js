// ==UserScript==
// @name         Cannabis Apotheke Row Selector
// @namespace    http://tampermonkey.net/
// @version      1.5
// @description  Add checkboxes to select rows in MUI DataGrid
// @author       You
// @match        https://shop.cannabis-apotheke-luebeck.de/account/dashboard
// @icon         https://www.google.com/s2/favicons?sz=64&domain=shop.cannabis-apotheke-luebeck.de
// @grant        GM_registerMenuCommand
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_download
// @require      https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js
// ==/UserScript==

(function () {
    'use strict';

    // Debug mode configuration
    const DEBUG_MODE_KEY = 'debugMode';
    let debugMode = GM_getValue(DEBUG_MODE_KEY, false);

    // Action buttons visibility configuration
    const BUTTONS_VISIBLE_KEY = 'actionButtonsVisible';
    let actionButtonsVisible = GM_getValue(BUTTONS_VISIBLE_KEY, true);

    function toggleDebugMode() {
        debugMode = !debugMode;
        GM_setValue(DEBUG_MODE_KEY, debugMode);
        alert(`Debug mode ${debugMode ? 'enabled' : 'disabled'}`);
    }

    function log(...args) {
        if (debugMode) {
            console.log('[Cannabis Apotheke]', ...args);
        }
    }

    // Register menu command for debug mode toggle
    GM_registerMenuCommand(debugMode ? '✓ Debug Mode' : 'Debug Mode', toggleDebugMode);

    // pdf-lib is loaded via @require, returns the PDFLib global
    function loadPdfLib() {
        return Promise.resolve(PDFLib);
    }

    const selectedRows = new Set();
    let checkboxesVisible = false;

    // Create and inject styles
    function injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .row-selector-checkbox {
                width: 18px;
                height: 18px;
                cursor: pointer;
                margin: 0 auto;
                display: block;
            }
            .MuiDataGrid-cell[data-field="__checkbox__"],
            .MuiDataGrid-columnHeader[data-field="__checkbox__"] {
                display: none !important;
                align-items: center !important;
                justify-content: center !important;
            }
            .checkboxes-visible .MuiDataGrid-cell[data-field="__checkbox__"],
            .checkboxes-visible .MuiDataGrid-columnHeader[data-field="__checkbox__"] {
                display: flex !important;
            }
            .row-selected {
                background-color: rgba(25, 118, 210, 0.08) !important;
            }
            .button-container {
                position: fixed;
                bottom: 70px;
                right: 20px;
                z-index: 9999;
                display: flex;
                gap: 10px;
                flex-direction: column;
                align-items: flex-end;
            }
            .action-button, .toggle-button {
                background-color: #1976d2;
                color: white;
                border: none;
                padding: 12px 24px;
                border-radius: 4px;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                box-shadow: 0 3px 5px rgba(0,0,0,0.2);
                transition: background-color 0.3s;
            }
            .action-button:hover, .toggle-button:hover {
                background-color: #1565c0;
            }
            .action-button:disabled {
                background-color: #ccc;
                cursor: not-allowed;
            }
            .toggle-button.active {
                background-color: #2e7d32;
            }
            .toggle-button.active:hover {
                background-color: #1b5e20;
            }
            .visibility-toggle {
                position: fixed;
                bottom: 20px;
                right: 80px;
                z-index: 10000;
                background-color: #424242;
                color: white;
                border: none;
                padding: 8px 12px;
                border-radius: 50%;
                font-size: 18px;
                cursor: pointer;
                box-shadow: 0 3px 5px rgba(0,0,0,0.3);
                transition: all 0.3s;
                width: 40px;
                height: 40px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .visibility-toggle:hover {
                background-color: #616161;
                transform: scale(1.1);
            }
            .button-container.hidden {
                display: none !important;
            }
        `;
        document.head.appendChild(style);
    }

    // Create buttons
    function createButtons() {
        const container = document.createElement('div');
        container.className = 'button-container';
        container.innerHTML = `
            <button class="toggle-button">Auswahlboxen anzeigen</button>
            <button class="action-button accept-button" disabled>Bestellungen bestätigen (0)</button>
            <button class="action-button print-labels-button" disabled>Labels ausdrucken & auf in Bearbeitung setzen (0)</button>
        `;
        document.body.appendChild(container);

        const acceptButton = container.querySelector('.accept-button');
        const printLabelsButton = container.querySelector('.print-labels-button');
        const toggleButton = container.querySelector('.toggle-button');

        acceptButton.addEventListener('click', handleAcceptAction);
        printLabelsButton.addEventListener('click', handlePrintLabelsAction);
        toggleButton.addEventListener('click', () => toggleCheckboxes(toggleButton));

        return {acceptButton, printLabelsButton, toggleButton};
    }

    // Create visibility toggle button
    function createVisibilityToggle(container) {
        const visibilityToggle = document.createElement('button');
        visibilityToggle.className = 'visibility-toggle';
        visibilityToggle.title = actionButtonsVisible ? 'Buttons verbergen' : 'Buttons anzeigen';
        visibilityToggle.textContent = actionButtonsVisible ? '×' : '+';
        document.body.appendChild(visibilityToggle);

        visibilityToggle.addEventListener('click', () => toggleActionButtons(container, visibilityToggle));

        return visibilityToggle;
    }

    // Toggle action buttons visibility
    function toggleActionButtons(container, visibilityToggle) {
        actionButtonsVisible = !actionButtonsVisible;
        GM_setValue(BUTTONS_VISIBLE_KEY, actionButtonsVisible);

        if (actionButtonsVisible) {
            container.classList.remove('hidden');
            visibilityToggle.textContent = '×';
            visibilityToggle.title = 'Buttons verbergen';
        } else {
            container.classList.add('hidden');
            visibilityToggle.textContent = '+';
            visibilityToggle.title = 'Buttons anzeigen';
        }
    }

    // Toggle checkboxes visibility
    function toggleCheckboxes(toggleButton) {
        checkboxesVisible = !checkboxesVisible;
        const dataGrid = document.querySelector('.MuiDataGrid-root');

        if (checkboxesVisible) {
            dataGrid.classList.add('checkboxes-visible');
            toggleButton.classList.add('active');
            toggleButton.textContent = 'Auswahlboxen verbergen';
        } else {
            dataGrid.classList.remove('checkboxes-visible');
            toggleButton.classList.remove('active');
            toggleButton.textContent = 'Auswahlboxen anzeigen';
        }
    }

    // Handle accept button click
    async function handleAcceptAction() {
        const selectedIds = Array.from(selectedRows);
        log('Accepting row IDs:', selectedIds);

        for (const rowId of selectedIds) {
            try {
                // Find the row
                const row = document.querySelector(`.MuiDataGrid-row[data-id="${rowId}"]`);
                if (!row) {
                    console.error(`Row with ID ${rowId} not found`);
                    continue;
                }

                // Find and click the reservation button
                const reservationButton = row.querySelector('div[data-field="reservation"] div[role="button"]');
                if (!reservationButton) {
                    console.error(`Reservation button not found for row ${rowId}`);
                    continue;
                }

                reservationButton.click();
                log(`Clicked reservation button for row ${rowId}`);

                // Click the appropriate button based on debug mode
                const buttonText = debugMode ? 'Abbrechen' : 'Speichern und senden';
                let formButton = null;
                for (let i = 0; i < 20 && !formButton; i++) {
                    await new Promise(resolve => setTimeout(resolve, 50));
                    formButton = document.evaluate(
                        `//button[text()="${buttonText}"]`,
                        document,
                        null,
                        XPathResult.FIRST_ORDERED_NODE_TYPE,
                        null
                    ).singleNodeValue;
                }
                if (!formButton) {
                    console.error(`Form button ("${buttonText}") not found for row ${rowId}`);
                    continue;
                }

                formButton.click();
                await new Promise(resolve => setTimeout(resolve, 750));

                log(`Clicked form "${buttonText}" button for row ${rowId}`);

            } catch (error) {
                console.error(`Error accepting row ${rowId}:`, error);
            }
        }

        log('Finished accepting all selected rows');
    }

    // Handle action button click
    async function handlePrintLabelsAction() {
        const selectedIds = Array.from(selectedRows);
        log('Processing labels for row IDs:', selectedIds);

        const results = [];

        for (const rowId of selectedIds) {
            try {
                // Find the row
                const row = document.querySelector(`.MuiDataGrid-row[data-id="${rowId}"]`);
                if (!row) {
                    console.error(`Row with ID ${rowId} not found`);
                    continue;
                }

                // Find and click the delivery button
                const deliveryButton = row.querySelector('div[data-field="delivery"] div[role="button"]');
                if (!deliveryButton) {
                    console.error(`Delivery button not found for row ${rowId}`);
                    continue;
                }

                deliveryButton.click();
                await new Promise(resolve => setTimeout(resolve, 75));

                // Find and click the button in the modal
                const modal = document.querySelector('div[aria-modal="true"]');
                if (!modal) {
                    console.error(`Modal not opened for row ${rowId}`);
                    continue;
                }

                let modalButton = modal.querySelector('thead th button');
                if (!modalButton) {
                    // Retry up to ~1.5s for the modal button to appear
                    let btnAttempts = 0;
                    while (!modalButton && btnAttempts < 20) {
                        await new Promise(resolve => setTimeout(resolve, 75));
                        modalButton = modal.querySelector('thead th button');
                        btnAttempts++;
                    }
                }
                if (!modalButton) {
                    console.error(`Modal button not found for row ${rowId}`);
                    continue;
                }

                // Wait for modal button to be enabled
                let attempts = 0;
                while (modalButton.disabled && attempts < 100) {
                    await new Promise(resolve => setTimeout(resolve, 75));
                    attempts++;
                }

                if (modalButton.disabled) {
                    console.error(`Modal button never enabled for row ${rowId}`);
                    continue;
                }

                log(`Modal button enabled after ${attempts * 75}ms for row ${rowId}`);

                modalButton.click();

                // Find and click the form button to open blob URL
                let formButton = null;
                for (let i = 0; i < 20 && !formButton; i++) {
                    await new Promise(resolve => setTimeout(resolve, 50));
                    formButton = document.evaluate(
                        '//button[text()="Etikett erzeugen"]',
                        document,
                        null,
                        XPathResult.FIRST_ORDERED_NODE_TYPE,
                        null
                    ).singleNodeValue;
                }
                if (formButton) {
                    // Intercept blob creation and window.open to capture PDF blob directly
                    const originalOpen = unsafeWindow.open;
                    const originalCreateObjectURL = unsafeWindow.URL.createObjectURL;
                    let capturedBlob = null;

                    // Intercept URL.createObjectURL to capture the blob directly
                    unsafeWindow.URL.createObjectURL = function (blob) {
                        log('URL.createObjectURL called with:', blob);
                        if (blob instanceof Blob && blob.type === 'application/pdf') {
                            capturedBlob = blob;
                            log('Captured PDF blob directly:', blob.size, 'bytes');
                        }
                        return originalCreateObjectURL.call(unsafeWindow.URL, blob);
                    };

                    // Intercept window.open to prevent popup
                    unsafeWindow.open = function (url, ...args) {
                        log('window.open called with:', url, args);
                        return {
                            closed: false,
                            location: {},
                            document: { write: () => {}, close: () => {} },
                            focus: () => {}
                        };
                    };

                    formButton.click();
                    await new Promise(resolve => setTimeout(resolve, 750));

                    // Restore original functions
                    unsafeWindow.open = originalOpen;
                    unsafeWindow.URL.createObjectURL = originalCreateObjectURL;

                    // Use the captured blob directly
                    if (capturedBlob) {
                        results.push({ labels: capturedBlob });
                        log(`Captured blob for row ${rowId}:`, capturedBlob.size, 'bytes');
                    } else {
                        console.warn(`No PDF blob was captured for row ${rowId}`);
                    }
                } else {
                    console.warn(`Form button not found for row ${rowId}`);
                }

                // Find and click the close button twice
                const labelCloseButton = document.evaluate(
                    '//div[text()="Etikett und Abfüllprotokoll"]/following-sibling::button[@aria-label="Schließen"]',
                    document,
                    null,
                    XPathResult.FIRST_ORDERED_NODE_TYPE,
                    null
                ).singleNodeValue;
                log(`Found close button for row ${rowId}`);
                if (labelCloseButton) {
                    labelCloseButton.click();
                    await new Promise(resolve => setTimeout(resolve, 75));

                    // Re-query for the second close button
                    const secondCloseButton = document.evaluate(
                        '//div[text()="Lieferinformationen"]/following-sibling::button[@aria-label="Schließen"]',
                        document,
                        null,
                        XPathResult.FIRST_ORDERED_NODE_TYPE,
                        null
                    ).singleNodeValue;
                    log(`Found second close button for row ${rowId}: ${!!secondCloseButton}`);
                    if (secondCloseButton) {
                        secondCloseButton.click();
                        await new Promise(resolve => setTimeout(resolve, 75));
                    }
                } else {
                    console.warn(`Close button not found for row ${rowId}`);
                }

            } catch (error) {
                console.error(`Error processing row ${rowId}:`, error);
            }
        }

        log('Finished processing all selected rows');
        log('Collected results:', results);

        // Merge all PDFs into one
        if (results.length > 0) {
            try {
                // Ensure pdf-lib is loaded
                await loadPdfLib();

                const mergedPdf = await mergePDFs(results.map(r => r.labels));
                log('Successfully merged PDFs');

                // Download the merged PDF
                const now = new Date();
                const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;
                downloadPDF(mergedPdf, `labels_${timestamp}.pdf`);

                // Change status of all processed rows to "inprocess"
                log('Changing status of processed rows to inprocess');
                for (const rowId of selectedIds) {
                    try {
                        const row = document.querySelector(`.MuiDataGrid-row[data-id="${rowId}"]`);
                        if (!row) {
                            console.error(`Row with ID ${rowId} not found for status update`);
                            continue;
                        }

                        // Find and click the reservation button
                        const reservationButton = row.querySelector('div[data-field="reservation"] div[role="button"]');
                        if (!reservationButton) {
                            console.error(`Reservation button not found for row ${rowId}`);
                            continue;
                        }

                        reservationButton.click();
                        await new Promise(resolve => setTimeout(resolve, 375));

                        // Click the status dropdown
                        const statusDropdown = document.querySelector('#status');
                        if (!statusDropdown) {
                            console.error(`Status dropdown not found for row ${rowId}`);
                            continue;
                        }

                        statusDropdown.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));;
                        await new Promise(resolve => setTimeout(resolve, 75));

                        // Select "inprocess" option
                        const inprocessOption = document.querySelector('#menu-status ul li[data-value="inprocess"]');
                        if (!inprocessOption) {
                            console.error(`Inprocess option not found for row ${rowId}`);
                            continue;
                        }

                        inprocessOption.click();
                        await new Promise(resolve => setTimeout(resolve, 75));

                        const sendMailCheckbox = document.querySelector('form input[name="sendMailToCustomer"]');
                        sendMailCheckbox.click();
                        await new Promise(resolve => setTimeout(resolve, 75));

                        // Click the appropriate button based on debug mode
                        const buttonText = debugMode ? 'Abbrechen' : 'Speichern und senden';
                        const formButton = document.evaluate(
                            `//button[text()="${buttonText}"]`,
                            document,
                            null,
                            XPathResult.FIRST_ORDERED_NODE_TYPE,
                            null
                        ).singleNodeValue;
                        if (!formButton) {
                            console.error(`Form button ("${buttonText}") not found for row ${rowId}`);
                            continue;
                        }

                        formButton.click();
                        await new Promise(resolve => setTimeout(resolve, 750));

                        log(`Changed status to inprocess for row ${rowId}`);

                    } catch (error) {
                        console.error(`Error changing status for row ${rowId}:`, error);
                    }
                }

                return mergedPdf;
            } catch (error) {
                console.error('Error merging PDFs:', error);
            }
        }

        return results;
    }

    // Download a PDF blob
    function downloadPDF(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // Merge multiple PDF blobs into one
    async function mergePDFs(blobs) {
        const {PDFDocument} = PDFLib;

        // Create a new PDF document
        const mergedPdf = await PDFDocument.create();

        // Process each blob
        for (const blob of blobs) {
            const arrayBuffer = await blob.arrayBuffer();
            const pdf = await PDFDocument.load(arrayBuffer);

            // Copy all pages from this PDF
            const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
            copiedPages.forEach(page => {
                mergedPdf.addPage(page);
            });
        }

        // Save the merged PDF
        const mergedPdfBytes = await mergedPdf.save();
        return new Blob([mergedPdfBytes], {type: 'application/pdf'});
    }

    // Update accept button state
    function updateAcceptButton(button) {
        const count = selectedRows.size;
        button.textContent = `Bestellungen bestätigen (${count})`;
        button.disabled = count === 0;
    }

    // Update print labels button state
    function updatePrintLabelsButton(button) {
        const count = selectedRows.size;
        button.textContent = `Labels ausdrucken & auf in Bearbeitung setzen (${count})`;
        button.disabled = count === 0;
    }

    // Add checkbox to a row
    function addCheckboxToRow(row, acceptButton, printLabelsButton) {
        // Skip if checkbox already exists
        if (row.querySelector('.row-selector-checkbox')) return;

        const dataId = row.getAttribute('data-id');
        if (!dataId) return;

        // Create checkbox cell
        const checkboxCell = document.createElement('div');
        checkboxCell.className = 'MuiDataGrid-cell MuiDataGrid-cell--textCenter';
        checkboxCell.setAttribute('role', 'gridcell');
        checkboxCell.setAttribute('data-field', '__checkbox__');
        checkboxCell.style.cssText = '--width: 50px; min-width: 50px;';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'row-selector-checkbox';
        checkbox.checked = selectedRows.has(dataId);

        checkbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                selectedRows.add(dataId);
                row.classList.add('row-selected');
            } else {
                selectedRows.delete(dataId);
                row.classList.remove('row-selected');
            }
            updateAcceptButton(acceptButton);
            updatePrintLabelsButton(printLabelsButton);
            updateSelectAllCheckbox();
        });

        checkboxCell.appendChild(checkbox);

        // Insert as first cell (after the offset div)
        const offsetDiv = row.querySelector('.MuiDataGrid-cellOffsetLeft');
        if (offsetDiv && offsetDiv.nextSibling) {
            offsetDiv.parentNode.insertBefore(checkboxCell, offsetDiv.nextSibling);
        } else {
            row.insertBefore(checkboxCell, row.firstChild);
        }

        // Apply selected state if already selected
        if (selectedRows.has(dataId)) {
            row.classList.add('row-selected');
        }
    }

    // Add checkbox to header
    function addCheckboxToHeader(acceptButton, printLabelsButton) {
        const header = document.querySelector('.MuiDataGrid-columnHeaders');
        if (!header || header.querySelector('.header-selector-checkbox')) return;

        const headerRow = header.querySelector('[role="row"]');
        if (!headerRow) return;

        const checkboxCell = document.createElement('div');
        checkboxCell.className = 'MuiDataGrid-columnHeader MuiDataGrid-columnHeader--sortable';
        checkboxCell.setAttribute('role', 'columnheader');
        checkboxCell.setAttribute('data-field', '__checkbox__');
        checkboxCell.style.cssText = '--width: 50px; min-width: 50px;';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'row-selector-checkbox header-selector-checkbox';

        checkbox.addEventListener('change', (e) => {
            const rows = document.querySelectorAll('.MuiDataGrid-row');
            rows.forEach(row => {
                const dataId = row.getAttribute('data-id');
                if (!dataId) return;

                const rowCheckbox = row.querySelector('.row-selector-checkbox');
                if (rowCheckbox) {
                    rowCheckbox.checked = e.target.checked;
                    if (e.target.checked) {
                        selectedRows.add(dataId);
                        row.classList.add('row-selected');
                    } else {
                        selectedRows.delete(dataId);
                        row.classList.remove('row-selected');
                    }
                }
            });
            updateAcceptButton(acceptButton);
            updatePrintLabelsButton(printLabelsButton);
        });

        checkboxCell.appendChild(checkbox);

        const offsetDiv = headerRow.querySelector('.MuiDataGrid-cellOffsetLeft');
        if (offsetDiv && offsetDiv.nextSibling) {
            offsetDiv.parentNode.insertBefore(checkboxCell, offsetDiv.nextSibling);
        } else {
            headerRow.insertBefore(checkboxCell, headerRow.firstChild);
        }
    }

    // Update select all checkbox state
    function updateSelectAllCheckbox() {
        const headerCheckbox = document.querySelector('.header-selector-checkbox');
        if (!headerCheckbox) return;

        const allRows = document.querySelectorAll('.MuiDataGrid-row');
        const allIds = Array.from(allRows)
            .map(row => row.getAttribute('data-id'))
            .filter(id => id);

        const allSelected = allIds.length > 0 && allIds.every(id => selectedRows.has(id));
        const someSelected = allIds.some(id => selectedRows.has(id));

        headerCheckbox.checked = allSelected;
        headerCheckbox.indeterminate = someSelected && !allSelected;
    }

    // Initialize
    function init() {
        injectStyles();
        const {acceptButton, printLabelsButton, toggleButton} = createButtons();

        // Get the button container
        const buttonContainer = document.querySelector('.button-container');

        // Apply initial visibility state
        if (!actionButtonsVisible) {
            buttonContainer.classList.add('hidden');
        }

        // Create visibility toggle button
        createVisibilityToggle(buttonContainer);

        // Initial setup
        setTimeout(() => {
            addCheckboxToHeader(acceptButton, printLabelsButton);
            document.querySelectorAll('.MuiDataGrid-row').forEach(row => {
                addCheckboxToRow(row, acceptButton, printLabelsButton);
            });
        }, 1000);

        // Watch for dynamically added rows
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) {
                        if (node.classList && node.classList.contains('MuiDataGrid-row')) {
                            addCheckboxToRow(node, acceptButton, printLabelsButton);
                        }
                        if (node.classList && node.classList.contains('MuiDataGrid-columnHeaders')) {
                            addCheckboxToHeader(acceptButton, printLabelsButton);
                        }
                        // Check children
                        if (node.querySelectorAll) {
                            node.querySelectorAll('.MuiDataGrid-row').forEach(row => {
                                addCheckboxToRow(row, acceptButton, printLabelsButton);
                            });
                        }
                    }
                });
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // Wait for page to load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
