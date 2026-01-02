// ==UserScript==
// @name         Cannabis Apotheke Row Selector
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Add checkboxes to select rows in MUI DataGrid
// @author       You
// @match        https://shop.cannabis-apotheke-luebeck.de/account/dashboard
// @icon         https://www.google.com/s2/favicons?sz=64&domain=shop.cannabis-apotheke-luebeck.de
// @grant        GM_registerMenuCommand
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_download
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

    // Load pdf-lib dynamically
    function loadPdfLib() {
        return new Promise((resolve, reject) => {
            if (window.PDFLib) {
                resolve(window.PDFLib);
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js';
            script.onload = () => resolve(window.PDFLib);
            script.onerror = () => reject(new Error('Failed to load pdf-lib'));
            document.head.appendChild(script);
        });
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
            <button class="action-button download-protocols-button" disabled>Protokolle erzeugen (0)</button>
            <button class="action-button ready-for-pickup-button" disabled>Auf abholbereit setzen & Mail versenden (0)</button>
        `;
        document.body.appendChild(container);

        const acceptButton = container.querySelector('.accept-button');
        const printLabelsButton = container.querySelector('.print-labels-button');
        const downloadProtocolsButton = container.querySelector('.download-protocols-button');
        const readyForPickupButton = container.querySelector('.ready-for-pickup-button');
        const toggleButton = container.querySelector('.toggle-button');

        acceptButton.addEventListener('click', handleAcceptAction);
        printLabelsButton.addEventListener('click', handlePrintLabelsAction);
        downloadProtocolsButton.addEventListener('click', handleDownloadProtocolsAction);
        readyForPickupButton.addEventListener('click', handleReadyForPickupAction);
        toggleButton.addEventListener('click', () => toggleCheckboxes(toggleButton));

        return {acceptButton, printLabelsButton, downloadProtocolsButton, readyForPickupButton, toggleButton};
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
                await new Promise(resolve => setTimeout(resolve, 250));

                log(`Clicked reservation button for row ${rowId}`);

                // Click the appropriate button based on debug mode
                const buttonType = debugMode ? 'button' : 'submit';
                const formButton = document.querySelector(`div[role="dialog"] form button[type="${buttonType}"]:not([aria-label]`);
                if (!formButton) {
                    console.error(`Form button (${buttonType}) not found for row ${rowId}`);
                    continue;
                }

                formButton.click();
                await new Promise(resolve => setTimeout(resolve, 500));

                log(`Clicked form ${buttonType} button for row ${rowId}`);

            } catch (error) {
                console.error(`Error accepting row ${rowId}:`, error);
            }
        }

        log('Finished accepting all selected rows');
    }

    // Handle ready for pickup button click
    async function handleReadyForPickupAction() {
        const selectedIds = Array.from(selectedRows);
        log('Setting rows to pickupready, row IDs:', selectedIds);

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
                await new Promise(resolve => setTimeout(resolve, 250));

                log(`Clicked reservation button for row ${rowId}`);

                // Click the status dropdown
                const statusDropdown = document.querySelector('#status');
                if (!statusDropdown) {
                    console.error(`Status dropdown not found for row ${rowId}`);
                    continue;
                }

                statusDropdown.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                await new Promise(resolve => setTimeout(resolve, 50));

                // Select "pickupready" option
                const pickupreadyOption = document.querySelector('#menu-status ul li[data-value="pickupready"]');
                if (!pickupreadyOption) {
                    console.error(`Pickupready option not found for row ${rowId}`);
                    continue;
                }

                pickupreadyOption.click();
                await new Promise(resolve => setTimeout(resolve, 50));

                // Click the appropriate button based on debug mode
                const buttonType = debugMode ? 'button' : 'submit';
                const formButton = document.querySelector(`div[role="dialog"] form button[type="${buttonType}"]:not([aria-label]`);
                if (!formButton) {
                    console.error(`Form button (${buttonType}) not found for row ${rowId}`);
                    continue;
                }

                formButton.click();
                await new Promise(resolve => setTimeout(resolve, 250));

                log(`Changed status to pickupready for row ${rowId}`);

            } catch (error) {
                console.error(`Error setting row ${rowId} to pickupready:`, error);
            }
        }

        log('Finished setting all selected rows to pickupready');
    }

    // Handle download protocols button click
    async function handleDownloadProtocolsAction() {
        const selectedIds = Array.from(selectedRows);
        log('Downloading protocols for row IDs:', selectedIds);

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
                await new Promise(resolve => setTimeout(resolve, 50));

                // Find and click the button in the modal
                const modal = document.querySelector('div[aria-modal="true"]');
                if (!modal) {
                    console.error(`Modal not opened for row ${rowId}`);
                    continue;
                }

                const modalButton = modal.querySelector('thead th button');
                if (!modalButton) {
                    console.error(`Modal button not found for row ${rowId}`);
                    continue;
                }

                // Wait for modal button to be enabled
                let attempts = 0;
                while (modalButton.disabled && attempts < 100) {
                    await new Promise(resolve => setTimeout(resolve, 50));
                    attempts++;
                }

                if (modalButton.disabled) {
                    console.error(`Modal button never enabled for row ${rowId}`);
                    continue;
                }

                log(`Modal button enabled after ${attempts * 50}ms for row ${rowId}`);

                modalButton.click();
                await new Promise(resolve => setTimeout(resolve, 50));

                // Loop over all amount fields and update is_amount fields
                let productIndex = 0;
                while (true) {
                    const amountField = document.querySelector(`input[name="products.${productIndex}.amount"]`);
                    if (!amountField) {
                        break; // No more products
                    }

                    // Read the current value
                    const currentValue = parseFloat(amountField.value);
                    if (!isNaN(currentValue)) {
                        // Add random value between 0 and 0.2
                        const randomValue = Math.random() * 0.2;
                        const increasedValue = currentValue + randomValue;

                        // Round to 2 decimal digits
                        const roundedValue = Math.round(increasedValue * 100) / 100;

                        // Set in corresponding is_amount field
                        const isAmountField = document.querySelector(`input[name="products.${productIndex}.is_amount"]`);
                        if (isAmountField) {
                            // Update the value and trigger React events for MUI controlled input
                            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                            nativeInputValueSetter.call(isAmountField, roundedValue.toFixed(2));

                            // Trigger input event for React to detect the change
                            const inputEvent = new Event('input', { bubbles: true });
                            isAmountField.dispatchEvent(inputEvent);

                            // Trigger change event as well
                            const changeEvent = new Event('change', { bubbles: true });
                            isAmountField.dispatchEvent(changeEvent);

                            log(`Set products.${productIndex}.is_amount to ${roundedValue.toFixed(2)} (from ${currentValue})`);
                        } else {
                            console.warn(`is_amount field not found for product ${productIndex}`);
                        }
                    }

                    // Open the packaging selectbox
                    const packageSelectBox = document.querySelector(`div[name="products.${productIndex}.packagename"] > div > div`);
                    if (packageSelectBox) {
                        // Open the MUI select by dispatching mousedown event
                        packageSelectBox.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                        await new Promise(resolve => setTimeout(resolve, 50));
                        log(`Opened package select for product ${productIndex}`);

                        // Select the appropriate option based on currentValue
                        const listItems = document.querySelectorAll('ul[role="listbox"] li');
                        if (listItems.length >= 3) {
                            let selectedItem;
                            if (currentValue <= 10) {
                                selectedItem = listItems[0];
                                log(`Selecting first option for product ${productIndex} (currentValue: ${currentValue})`);
                            } else if (currentValue <= 25) {
                                selectedItem = listItems[1];
                                log(`Selecting second option for product ${productIndex} (currentValue: ${currentValue})`);
                            } else {
                                selectedItem = listItems[2];
                                log(`Selecting third option for product ${productIndex} (currentValue: ${currentValue})`);
                            }
                            selectedItem.click();
                            await new Promise(resolve => setTimeout(resolve, 50));
                        } else {
                            console.warn(`Expected 3 list items, found ${listItems.length} for product ${productIndex}`);
                        }
                    } else {
                        console.warn(`Package select not found for product ${productIndex}`);
                    }

                    productIndex++;
                }

                // Select the acting person
                const workerSelectBox = document.querySelector('div[name="worker"] > div > div');
                if (workerSelectBox) {
                    workerSelectBox.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                    await new Promise(resolve => setTimeout(resolve, 50));

                    // Pick one of the first four options randomly
                    const workerOptions = document.querySelectorAll('ul[role="listbox"] li');
                    if (workerOptions.length >= 1) {
                        const maxIndex = Math.min(4, workerOptions.length);
                        const randomIndex = Math.floor(Math.random() * maxIndex);
                        workerOptions[randomIndex].click();
                        await new Promise(resolve => setTimeout(resolve, 50));
                        log(`Selected worker option ${randomIndex} for row ${rowId}`);
                    } else {
                        console.warn(`No worker options found for row ${rowId}`);
                    }
                } else {
                    console.warn(`Worker select not found for row ${rowId}`);
                }

                // Find and click the form button to download protocol
                const formButton = document.evaluate(
                    '//button[text()="Protokoll erzeugen"]',
                    document,
                    null,
                    XPathResult.FIRST_ORDERED_NODE_TYPE,
                    null
                ).singleNodeValue;
                if (formButton) {
                    // Intercept blob URL opening
                    const originalOpen = unsafeWindow.open;
                    let blobUrl = null;

                    unsafeWindow.open = function (url, ...args) {
                        log('window.open called with:', url, args);

                        // Return a proxy window that intercepts location.href assignment
                        const fakeWindow = {
                            closed: false,
                            location: new Proxy({}, {
                                set(target, prop, value) {
                                    log(`Intercepted location.${prop} = ${value}`);
                                    if (prop === 'href' && value && value.startsWith('blob:')) {
                                        blobUrl = value;
                                        log('Captured blob URL via location.href:', blobUrl);
                                    }
                                    target[prop] = value;
                                    return true;
                                },
                                get(target, prop) {
                                    return target[prop];
                                }
                            }),
                            document: {
                                write: () => {},
                                close: () => {}
                            },
                            focus: () => {}
                        };

                        // Also check if URL is directly a blob
                        if (url && url.startsWith('blob:')) {
                            blobUrl = url;
                            log('Captured blob URL directly:', blobUrl);
                        }

                        return fakeWindow;
                    };

                    formButton.click();
                    await new Promise(resolve => setTimeout(resolve, 500));

                    // Restore original window.open
                    unsafeWindow.open = originalOpen;

                    log('Final blobUrl:', blobUrl);

                    // Download the blob if we captured it
                    if (blobUrl) {
                        try {
                            // Generate filename with timestamp and row ID
                            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
                            const filename = `Protokoll_${rowId}_${timestamp}.pdf`;
                            const savePath = `C:\\Users\\xtwin\\Desktop\\Cannabis Protokolle\\${filename}`;

                            // Download using GM_download
                            GM_download({
                                url: blobUrl,
                                name: savePath,
                                saveAs: false,
                                onload: () => {
                                    log(`Successfully downloaded protocol for row ${rowId} to ${savePath}`);
                                },
                                onerror: (error) => {
                                    console.error(`Error downloading protocol for row ${rowId}:`, error);
                                }
                            });
                        } catch (error) {
                            console.error(`Error processing blob for row ${rowId}:`, error);
                        }
                    } else {
                        console.warn(`No blob URL was captured for row ${rowId}`);
                    }
                } else {
                    console.warn(`Form button not found for row ${rowId}`);
                }

                // Find and click the close button twice
                let closeButtons = document.querySelectorAll('button[aria-label="close"]');
                log(`Found ${closeButtons.length} close buttons for row ${rowId}`);
                if (closeButtons.length > 0) {
                    // Get the innermost (last) close button
                    let closeButton = closeButtons[closeButtons.length - 1];

                    closeButton.click();
                    await new Promise(resolve => setTimeout(resolve, 50));

                    // Re-query for the second click
                    closeButtons = document.querySelectorAll('div[role="dialog"] button[aria-label="close"]');
                    log(`Found ${closeButtons.length} close buttons after first click for row ${rowId}`);
                    if (closeButtons.length > 0) {
                        closeButton = closeButtons[0];
                        closeButton.click();
                        await new Promise(resolve => setTimeout(resolve, 50));
                    }
                } else {
                    console.warn(`Close button not found for row ${rowId}`);
                }

            } catch (error) {
                console.error(`Error processing row ${rowId}:`, error);
            }
        }

        log('Finished downloading protocols for all selected rows');
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
                await new Promise(resolve => setTimeout(resolve, 50));

                // Find and click the button in the modal
                const modal = document.querySelector('div[aria-modal="true"]');
                if (!modal) {
                    console.error(`Modal not opened for row ${rowId}`);
                    continue;
                }

                const modalButton = modal.querySelector('thead th button');
                if (!modalButton) {
                    console.error(`Modal button not found for row ${rowId}`);
                    continue;
                }

                // Wait for modal button to be enabled
                let attempts = 0;
                while (modalButton.disabled && attempts < 100) {
                    await new Promise(resolve => setTimeout(resolve, 50));
                    attempts++;
                }

                if (modalButton.disabled) {
                    console.error(`Modal button never enabled for row ${rowId}`);
                    continue;
                }

                log(`Modal button enabled after ${attempts * 50}ms for row ${rowId}`);

                modalButton.click();
                await new Promise(resolve => setTimeout(resolve, 50));

                // Find and click the form button to open blob URL
                const formButton = document.evaluate(
                    '//button[text()="Label erzeugen"]',
                    document,
                    null,
                    XPathResult.FIRST_ORDERED_NODE_TYPE,
                    null
                ).singleNodeValue;
                if (formButton) {
                    // Intercept blob URL opening and prevent popup
                    const originalOpen = unsafeWindow.open;
                    let blobUrl = null;

                    unsafeWindow.open = function (url, ...args) {
                        log('window.open called with:', url, args);

                        // Return a proxy window that intercepts location.href assignment
                        const fakeWindow = {
                            closed: false,
                            location: new Proxy({}, {
                                set(target, prop, value) {
                                    log(`Intercepted location.${prop} = ${value}`);
                                    if (prop === 'href' && value && value.startsWith('blob:')) {
                                        blobUrl = value;
                                        log('Captured blob URL via location.href:', blobUrl);
                                    }
                                    target[prop] = value;
                                    return true;
                                },
                                get(target, prop) {
                                    return target[prop];
                                }
                            }),
                            document: {
                                write: () => {
                                }, close: () => {
                                }
                            },
                            focus: () => {
                            }
                        };

                        // Also check if URL is directly a blob
                        if (url && url.startsWith('blob:')) {
                            blobUrl = url;
                            log('Captured blob URL directly:', blobUrl);
                        }

                        return fakeWindow;
                    };

                    formButton.click();
                    await new Promise(resolve => setTimeout(resolve, 500));

                    // Restore original window.open
                    unsafeWindow.open = originalOpen;

                    log('Final blobUrl:', blobUrl);

                    // Fetch the blob if we captured it
                    if (blobUrl) {
                        try {
                            const response = await fetch(blobUrl);
                            const blob = await response.blob();

                            const result = {
                                labels: blob
                            };

                            results.push(result);
                            log(`Result for row ${rowId}:`, result);
                        } catch (error) {
                            console.error(`Error processing blob for row ${rowId}:`, error);
                        }
                    } else {
                        console.warn(`No blob URL was captured for row ${rowId}`);
                    }
                } else {
                    console.warn(`Form button not found for row ${rowId}`);
                }

                // Find and click the close button twice
                let closeButtons = document.querySelectorAll('button[aria-label="close"]');
                log(`Found ${closeButtons.length} close buttons for row ${rowId}`);
                if (closeButtons.length > 0) {
                    // Get the innermost (last) close button
                    let closeButton = closeButtons[closeButtons.length - 1];

                    closeButton.click();
                    await new Promise(resolve => setTimeout(resolve, 50));

                    // Re-query for the second click
                    closeButtons = document.querySelectorAll('div[role="dialog"] button[aria-label="close"]');
                    log(`Found ${closeButtons.length} close buttons after first click for row ${rowId}`);
                    if (closeButtons.length > 0) {
                        closeButton = closeButtons[0];
                        closeButton.click();
                        await new Promise(resolve => setTimeout(resolve, 50));
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
                downloadPDF(mergedPdf, 'merged-labels.pdf');

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
                        await new Promise(resolve => setTimeout(resolve, 50));

                        // Click the status dropdown
                        const statusDropdown = document.querySelector('#status');
                        if (!statusDropdown) {
                            console.error(`Status dropdown not found for row ${rowId}`);
                            continue;
                        }

                        statusDropdown.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));;
                        await new Promise(resolve => setTimeout(resolve, 50));

                        // Select "inprocess" option
                        const inprocessOption = document.querySelector('#menu-status ul li[data-value="inprocess"]');
                        if (!inprocessOption) {
                            console.error(`Inprocess option not found for row ${rowId}`);
                            continue;
                        }

                        inprocessOption.click();
                        await new Promise(resolve => setTimeout(resolve, 50));

                        const sendMailCheckbox = document.querySelector('form input[name="sendMailToCustomer"]');
                        sendMailCheckbox.click();
                        await new Promise(resolve => setTimeout(resolve, 50));

                        // Click the appropriate button based on debug mode
                        const buttonType = debugMode ? 'button' : 'submit';
                        const formButton = document.querySelector(`div[role="dialog"] form button[type="${buttonType}"]:not([aria-label]`);
                        if (!formButton) {
                            console.error(`Form button (${buttonType}) not found for row ${rowId}`);
                            continue;
                        }

                        formButton.click();
                        await new Promise(resolve => setTimeout(resolve, 250));

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

    // Update download protocols button state
    function updateDownloadProtocolsButton(button) {
        const count = selectedRows.size;
        button.textContent = `Protokolle erzeugen (${count})`;
        button.disabled = count === 0;
    }

    // Update ready for pickup button state
    function updateReadyForPickupButton(button) {
        const count = selectedRows.size;
        button.textContent = `Auf abholbereit setzen & Mail versenden (${count})`;
        button.disabled = count === 0;
    }

    // Add checkbox to a row
    function addCheckboxToRow(row, acceptButton, printLabelsButton, downloadProtocolsButton, readyForPickupButton) {
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
            updateDownloadProtocolsButton(downloadProtocolsButton);
            updateReadyForPickupButton(readyForPickupButton);
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
    function addCheckboxToHeader(acceptButton, printLabelsButton, downloadProtocolsButton, readyForPickupButton) {
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
            updateDownloadProtocolsButton(downloadProtocolsButton);
            updateReadyForPickupButton(readyForPickupButton);
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
        const {acceptButton, printLabelsButton, downloadProtocolsButton, readyForPickupButton, toggleButton} = createButtons();

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
            addCheckboxToHeader(acceptButton, printLabelsButton, downloadProtocolsButton, readyForPickupButton);
            document.querySelectorAll('.MuiDataGrid-row').forEach(row => {
                addCheckboxToRow(row, acceptButton, printLabelsButton, downloadProtocolsButton, readyForPickupButton);
            });
        }, 1000);

        // Watch for dynamically added rows
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) {
                        if (node.classList && node.classList.contains('MuiDataGrid-row')) {
                            addCheckboxToRow(node, acceptButton, printLabelsButton, downloadProtocolsButton, readyForPickupButton);
                        }
                        if (node.classList && node.classList.contains('MuiDataGrid-columnHeaders')) {
                            addCheckboxToHeader(acceptButton, printLabelsButton, downloadProtocolsButton, readyForPickupButton);
                        }
                        // Check children
                        if (node.querySelectorAll) {
                            node.querySelectorAll('.MuiDataGrid-row').forEach(row => {
                                addCheckboxToRow(row, acceptButton, printLabelsButton, downloadProtocolsButton, readyForPickupButton);
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
