// ==UserScript==
// @name         Cannabis Apotheke Row Selector
// @namespace    http://tampermonkey.net/
// @version      0.2
// @description  Add checkboxes to select rows in MUI DataGrid
// @author       You
// @match        https://shop.cannabis-apotheke-luebeck.de/account/dashboard
// @icon         https://www.google.com/s2/favicons?sz=64&domain=shop.cannabis-apotheke-luebeck.de
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

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
                bottom: 20px;
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
        `;
        document.head.appendChild(style);
    }

    // Create buttons
    function createButtons() {
        const container = document.createElement('div');
        container.className = 'button-container';
        container.innerHTML = `
            <button class="toggle-button">Show Checkboxes</button>
            <button class="action-button" disabled>Labels ausdrucken (0)</button>
        `;
        document.body.appendChild(container);

        const actionButton = container.querySelector('.action-button');
        const toggleButton = container.querySelector('.toggle-button');

        actionButton.addEventListener('click', handleAction);
        toggleButton.addEventListener('click', () => toggleCheckboxes(toggleButton));

        return { actionButton, toggleButton };
    }

    // Toggle checkboxes visibility
    function toggleCheckboxes(toggleButton) {
        checkboxesVisible = !checkboxesVisible;
        const dataGrid = document.querySelector('.MuiDataGrid-root');

        if (checkboxesVisible) {
            dataGrid.classList.add('checkboxes-visible');
            toggleButton.classList.add('active');
            toggleButton.textContent = 'Hide Checkboxes';
        } else {
            dataGrid.classList.remove('checkboxes-visible');
            toggleButton.classList.remove('active');
            toggleButton.textContent = 'Show Checkboxes';
        }
    }

    // Handle action button click
    async function handleAction() {
        const selectedIds = Array.from(selectedRows);
        console.log('Processing labels for row IDs:', selectedIds);

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

                deliveryButton.style.border = '3px solid red';
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

                modalButton.style.border = '3px solid red';
                modalButton.click();
                await new Promise(resolve => setTimeout(resolve, 50));

                // Find and click the close button twice
                let closeButtons = document.querySelectorAll('button[aria-label="close"]');
                console.log(`Found ${closeButtons.length} close buttons for row ${rowId}`);
                if (closeButtons.length > 0) {
                    // Get the innermost (last) close button
                    let closeButton = closeButtons[closeButtons.length - 1];

                    closeButton.style.border = '3px solid red';
                    closeButton.click();
                    await new Promise(resolve => setTimeout(resolve, 50));

                    // Re-query for the second click
                    closeButtons = document.querySelectorAll('button[aria-label="close"]');
                    console.log(`Found ${closeButtons.length} close buttons after first click for row ${rowId}`);
                    if (closeButtons.length > 0) {
                        closeButton = closeButtons[closeButtons.length - 1];
                        closeButton.style.border = '3px solid red';
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

        console.log('Finished processing all selected rows');
    }

    // Update action button state
    function updateActionButton(button) {
        const count = selectedRows.size;
        button.textContent = `Labels ausdrucken (${count})`;
        button.disabled = count === 0;
    }

    // Add checkbox to a row
    function addCheckboxToRow(row, button) {
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
            updateActionButton(button);
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
    function addCheckboxToHeader(button) {
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
            updateActionButton(button);
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
        const { actionButton, toggleButton } = createButtons();

        // Initial setup
        setTimeout(() => {
            addCheckboxToHeader(actionButton);
            document.querySelectorAll('.MuiDataGrid-row').forEach(row => {
                addCheckboxToRow(row, actionButton);
            });
        }, 1000);

        // Watch for dynamically added rows
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) {
                        if (node.classList && node.classList.contains('MuiDataGrid-row')) {
                            addCheckboxToRow(node, actionButton);
                        }
                        if (node.classList && node.classList.contains('MuiDataGrid-columnHeaders')) {
                            addCheckboxToHeader(actionButton);
                        }
                        // Check children
                        if (node.querySelectorAll) {
                            node.querySelectorAll('.MuiDataGrid-row').forEach(row => {
                                addCheckboxToRow(row, actionButton);
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
