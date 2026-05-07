// ==UserScript==
// @name         Cannabis Apotheke Row Selector
// @namespace    http://tampermonkey.net/
// @version      1.8
// @description  Print labels for selected rows in MUI DataGrid
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

    // Create and inject styles
    function injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
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
            .action-button {
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
            .action-button:hover {
                background-color: #1565c0;
            }
            .action-button:disabled {
                background-color: #ccc;
                cursor: not-allowed;
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
            <button class="action-button print-labels-button" disabled>Labels ausdrucken (0)</button>
        `;
        document.body.appendChild(container);

        const printLabelsButton = container.querySelector('.print-labels-button');
        printLabelsButton.addEventListener('click', handlePrintLabelsAction);

        return {printLabelsButton};
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

    // Handle action button click
    async function handlePrintLabelsAction() {
        const checkedBoxes = Array.from(document.querySelectorAll('input[name="select_row"]:checked'));
        const rows = checkedBoxes.map(cb => cb.closest('.MuiDataGrid-row')).filter(Boolean);
        log('Processing labels for rows:', rows.length);

        const results = [];

        for (const row of rows) {
            const rowId = row.getAttribute('data-id');
            try {
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
                    for (let i = 0; i < 50 && !capturedBlob; i++) {
                        await new Promise(resolve => setTimeout(resolve, 50));
                    }

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

    // Update print labels button state
    function updatePrintLabelsButton(button) {
        const count = document.querySelectorAll('input[name="select_row"]:checked').length;
        button.textContent = `Labels ausdrucken (${count})`;
        button.disabled = count === 0;
    }

    // Initialize
    function init() {
        injectStyles();
        const {printLabelsButton} = createButtons();

        // Get the button container
        const buttonContainer = document.querySelector('.button-container');

        // Apply initial visibility state
        if (!actionButtonsVisible) {
            buttonContainer.classList.add('hidden');
        }

        // Create visibility toggle button
        createVisibilityToggle(buttonContainer);

        // Listen for native checkbox changes
        document.addEventListener('change', (e) => {
            if (e.target.type !== 'checkbox') return;
            if (e.target.name === 'select_row') {
                const row = e.target.closest('.MuiDataGrid-row');
                if (row) {
                    row.classList.toggle('row-selected', e.target.checked);
                }
                updatePrintLabelsButton(printLabelsButton);
            }
        });

        // MutationObserver catches select-all state changes: React rerenders the row checkboxes
        // rather than firing change events, so we watch the grid for DOM mutations.
        setTimeout(() => {
            updatePrintLabelsButton(printLabelsButton);
            const grid = document.querySelector('.MuiDataGrid-root');
            if (grid) {
                let debounceTimer = null;
                new MutationObserver(() => {
                    clearTimeout(debounceTimer);
                    debounceTimer = setTimeout(() => updatePrintLabelsButton(printLabelsButton), 50);
                }).observe(grid, { subtree: true, childList: true, attributes: true, attributeFilter: ['checked'] });
            }
        }, 1000);
    }

    // Wait for page to load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();