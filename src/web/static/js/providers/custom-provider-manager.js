/**
 * Custom Provider Manager - CRUD operations for user-defined OpenAI-compatible providers
 */

import { ApiClient } from '../core/api-client.js';
import { MessageLogger } from '../ui/message-logger.js';
import { DomHelpers } from '../ui/dom-helpers.js';
import { t } from '../i18n/i18n.js';

let modalElement = null;
let currentEditSlug = null;

/**
 * Initialize the custom provider modal
 */
function initModal() {
    modalElement = document.getElementById('customProviderModal');
    if (!modalElement) {
        console.warn('[CustomProviderManager] Modal element not found');
        return;
    }

    // Close button
    const closeBtn = modalElement.querySelector('.close-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeModal);
    }

    // Cancel button
    const cancelBtn = document.getElementById('customProviderCancel');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', closeModal);
    }

    // Save button
    const saveBtn = document.getElementById('customProviderSave');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveProvider);
    }

    // Test connection button
    const testBtn = document.getElementById('customProviderTest');
    if (testBtn) {
        testBtn.addEventListener('click', testConnection);
    }

    // Add new provider button
    const addBtn = document.getElementById('customProviderAdd');
    if (addBtn) {
        addBtn.addEventListener('click', showAddForm);
    }

    // Close on overlay click
    modalElement.addEventListener('click', (e) => {
        if (e.target === modalElement) {
            closeModal();
        }
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modalElement && !modalElement.classList.contains('hidden')) {
            closeModal();
        }
    });
}

/**
 * Open the custom provider management modal
 */
export async function openModal() {
    if (!modalElement) {
        initModal();
    }
    if (!modalElement) return;

    await loadProviderList();
    showListView();
    modalElement.classList.remove('hidden');
}

/**
 * Close the modal
 */
function closeModal() {
    if (modalElement) {
        modalElement.classList.add('hidden');
    }
    currentEditSlug = null;
}

/**
 * Show the list view
 */
function showListView() {
    const listView = document.getElementById('customProviderListView');
    const formView = document.getElementById('customProviderFormView');
    if (listView) listView.classList.remove('hidden');
    if (formView) formView.classList.add('hidden');
}

/**
 * Show the add/edit form
 */
function showAddForm() {
    currentEditSlug = null;
    clearForm();
    updateFormTitle(false);

    const listView = document.getElementById('customProviderListView');
    const formView = document.getElementById('customProviderFormView');
    if (listView) listView.classList.add('hidden');
    if (formView) formView.classList.remove('hidden');
}

/**
 * Show the edit form for an existing provider
 */
async function showEditForm(slug) {
    try {
        const response = await ApiClient.get('/api/custom-providers');
        const provider = response.providers?.find(p => p.slug === slug);
        if (!provider) {
            MessageLogger.showMessage(t('settings:custom_provider_not_found'), 'error');
            return;
        }

        currentEditSlug = slug;
        fillForm(provider);
        updateFormTitle(true);

        const listView = document.getElementById('customProviderListView');
        const formView = document.getElementById('customProviderFormView');
        if (listView) listView.classList.add('hidden');
        if (formView) formView.classList.remove('hidden');
    } catch (error) {
        MessageLogger.showMessage(t('settings:custom_provider_load_error', { error: error.message }), 'error');
    }
}

/**
 * Update form title based on add/edit mode
 */
function updateFormTitle(isEdit) {
    const titleEl = document.getElementById('customProviderFormTitle');
    if (titleEl) {
        titleEl.textContent = isEdit
            ? t('settings:custom_provider_edit')
            : t('settings:custom_provider_add');
    }
}

/**
 * Clear the form fields
 */
function clearForm() {
    const nameInput = document.getElementById('customProviderName');
    const endpointInput = document.getElementById('customProviderEndpoint');
    const apiKeyInput = document.getElementById('customProviderApiKey');
    const modelInput = document.getElementById('customProviderModel');
    const testResult = document.getElementById('customProviderTestResult');

    if (nameInput) nameInput.value = '';
    if (endpointInput) endpointInput.value = '';
    if (apiKeyInput) apiKeyInput.value = '';
    if (modelInput) modelInput.value = '';
    if (testResult) {
        testResult.textContent = '';
        testResult.className = 'test-result';
    }
}

/**
 * Fill form with provider data
 */
function fillForm(provider) {
    const nameInput = document.getElementById('customProviderName');
    const endpointInput = document.getElementById('customProviderEndpoint');
    const apiKeyInput = document.getElementById('customProviderApiKey');
    const modelInput = document.getElementById('customProviderModel');
    const testResult = document.getElementById('customProviderTestResult');

    if (nameInput) nameInput.value = provider.name || '';
    if (endpointInput) endpointInput.value = provider.endpoint || '';
    if (apiKeyInput) apiKeyInput.value = '';  // Never show existing API key
    if (modelInput) modelInput.value = provider.model || '';
    if (testResult) {
        testResult.textContent = '';
        testResult.className = 'test-result';
    }
}

/**
 * Load and display the list of custom providers
 */
async function loadProviderList() {
    const listContainer = document.getElementById('customProviderList');
    if (!listContainer) return;

    try {
        const response = await ApiClient.get('/api/custom-providers');
        const providers = response.providers || [];

        if (providers.length === 0) {
            listContainer.innerHTML = `
                <div class="empty-state">
                    <span class="material-symbols-outlined">dns</span>
                    <p data-i18n="settings:custom_provider_empty">${t('settings:custom_provider_empty')}</p>
                </div>
            `;
            return;
        }

        listContainer.innerHTML = providers.map(p => `
            <div class="provider-item" data-slug="${DomHelpers.escapeHtml(p.slug)}">
                <div class="provider-info">
                    <span class="provider-name">${DomHelpers.escapeHtml(p.name)}</span>
                    <span class="provider-endpoint">${DomHelpers.escapeHtml(p.endpoint)}</span>
                </div>
                <div class="provider-actions">
                    <button class="btn btn-icon edit-btn" title="${t('settings:custom_provider_edit')}">
                        <span class="material-symbols-outlined">edit</span>
                    </button>
                    <button class="btn btn-icon delete-btn" title="${t('settings:custom_provider_delete')}">
                        <span class="material-symbols-outlined">delete</span>
                    </button>
                </div>
            </div>
        `).join('');

        // Attach event listeners
        listContainer.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const slug = e.target.closest('.provider-item').dataset.slug;
                showEditForm(slug);
            });
        });

        listContainer.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const slug = e.target.closest('.provider-item').dataset.slug;
                const name = e.target.closest('.provider-item').querySelector('.provider-name').textContent;
                deleteProvider(slug, name);
            });
        });

    } catch (error) {
        listContainer.innerHTML = `
            <div class="error-state">
                <p>${t('settings:custom_provider_load_error', { error: error.message })}</p>
            </div>
        `;
    }
}

/**
 * Save provider (add or update)
 */
async function saveProvider() {
    const nameInput = document.getElementById('customProviderName');
    const endpointInput = document.getElementById('customProviderEndpoint');
    const apiKeyInput = document.getElementById('customProviderApiKey');
    const modelInput = document.getElementById('customProviderModel');

    const data = {
        name: nameInput?.value?.trim() || '',
        endpoint: endpointInput?.value?.trim() || '',
        api_key: apiKeyInput?.value?.trim() || '',
        model: modelInput?.value?.trim() || ''
    };

    // Validation
    if (!data.name) {
        MessageLogger.showMessage(t('settings:custom_provider_name_required'), 'error');
        nameInput?.focus();
        return;
    }
    if (!data.endpoint) {
        MessageLogger.showMessage(t('settings:custom_provider_endpoint_required'), 'error');
        endpointInput?.focus();
        return;
    }
    if (!data.endpoint.startsWith('http://') && !data.endpoint.startsWith('https://')) {
        MessageLogger.showMessage(t('settings:custom_provider_endpoint_invalid'), 'error');
        endpointInput?.focus();
        return;
    }

    try {
        if (currentEditSlug) {
            // Update existing
            await ApiClient.put(`/api/custom-providers/${currentEditSlug}`, data);
            MessageLogger.showMessage(t('settings:custom_provider_updated'), 'success');
        } else {
            // Create new
            await ApiClient.post('/api/custom-providers', data);
            MessageLogger.showMessage(t('settings:custom_provider_added'), 'success');
        }

        // Refresh list and notify other components
        await loadProviderList();
        showListView();
        notifyProvidersUpdated();

    } catch (error) {
        const errorMsg = error.message || t('settings:custom_provider_save_error');
        MessageLogger.showMessage(errorMsg, 'error');
    }
}

/**
 * Delete a provider
 */
async function deleteProvider(slug, name) {
    const confirmed = confirm(t('settings:custom_provider_delete_confirm', { name }));
    if (!confirmed) return;

    try {
        await ApiClient.delete(`/api/custom-providers/${slug}`);
        MessageLogger.showMessage(t('settings:custom_provider_deleted', { name }), 'success');

        await loadProviderList();
        notifyProvidersUpdated();

    } catch (error) {
        MessageLogger.showMessage(t('settings:custom_provider_delete_error', { error: error.message }), 'error');
    }
}

/**
 * Test connection to the provider endpoint
 */
async function testConnection() {
    const testResult = document.getElementById('customProviderTestResult');
    const testBtn = document.getElementById('customProviderTest');

    if (!testResult || !testBtn) return;

    // For new providers, we need to save first then test
    // For existing providers, test directly
    if (!currentEditSlug) {
        testResult.textContent = t('settings:custom_provider_test_save_first');
        testResult.className = 'test-result warning';
        return;
    }

    testBtn.disabled = true;
    testResult.textContent = t('settings:custom_provider_testing');
    testResult.className = 'test-result';

    try {
        const response = await ApiClient.post(`/api/custom-providers/${currentEditSlug}/test`, {});

        if (response.success) {
            testResult.textContent = t('settings:custom_provider_test_success', { count: response.model_count || 0 });
            testResult.className = 'test-result success';
        } else {
            testResult.textContent = t('settings:custom_provider_test_failed', { error: response.error });
            testResult.className = 'test-result error';
        }
    } catch (error) {
        testResult.textContent = t('settings:custom_provider_test_failed', { error: error.message });
        testResult.className = 'test-result error';
    } finally {
        testBtn.disabled = false;
    }
}

/**
 * Notify other components that providers have been updated
 */
async function notifyProvidersUpdated() {
    try {
        const response = await ApiClient.get('/api/custom-providers');
        window.dispatchEvent(new CustomEvent('customProvidersUpdated', {
            detail: { providers: response.providers || [] }
        }));
    } catch (error) {
        console.error('[CustomProviderManager] Failed to fetch updated providers:', error);
    }
}

/**
 * Initialize when DOM is ready
 */
export function initialize() {
    // Initialize modal on first use
    const manageBtn = document.getElementById('manageCustomProviders');
    if (manageBtn) {
        manageBtn.addEventListener('click', openModal);
    }
}

export const CustomProviderManager = {
    initialize,
    openModal
};
