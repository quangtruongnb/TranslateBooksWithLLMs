# Custom OpenAI-Compatible Providers

**Date:** 2026-06-19  
**Status:** Approved  
**Author:** Claude + User

## Overview

Allow users to define their own OpenAI-compatible providers without code changes. Custom providers appear alongside built-in providers (Ollama, Gemini, OpenAI, etc.) in the provider dropdown and support the same features: model fetching, API key management, and translation.

## Use Cases

- Local servers: LM Studio, llama.cpp, vLLM, Ollama via OpenAI API
- Self-hosted solutions: text-generation-webui, LocalAI
- Company internal APIs
- New OpenAI-compatible services (Groq, Together.ai, etc.) without waiting for code updates

## Data Model

### .env Format

Custom providers use double-underscore delimiters for clean parsing:

```bash
CUSTOM_PROVIDER__{ID}__NAME=<display name>
CUSTOM_PROVIDER__{ID}__ENDPOINT=<API endpoint URL>
CUSTOM_PROVIDER__{ID}__API_KEY=<optional API key>
CUSTOM_PROVIDER__{ID}__MODEL=<default model>
```

**Example:**

```bash
# LM Studio local server
CUSTOM_PROVIDER__LM_STUDIO__NAME=LM Studio
CUSTOM_PROVIDER__LM_STUDIO__ENDPOINT=http://localhost:1234/v1/chat/completions
CUSTOM_PROVIDER__LM_STUDIO__API_KEY=
CUSTOM_PROVIDER__LM_STUDIO__MODEL=local-model

# Company internal API
CUSTOM_PROVIDER__COMPANY_API__NAME=Company API
CUSTOM_PROVIDER__COMPANY_API__ENDPOINT=https://llm.internal.company.com/v1/chat/completions
CUSTOM_PROVIDER__COMPANY_API__API_KEY=sk-internal-xxx
CUSTOM_PROVIDER__COMPANY_API__MODEL=gpt-4-internal
```

### ID Generation

Provider ID (slug) is derived from the display name:

- Replace spaces and special characters with `_`
- Convert to uppercase
- Strip leading/trailing underscores

Examples:
- "LM Studio" → `LM_STUDIO`
- "My vLLM Server" → `MY_VLLM_SERVER`
- "company-api" → `COMPANY_API`

### Provider Identifiers

- **Slug** (env var ID): `LM_STUDIO` (uppercase, used in .env keys)
- **Provider type** (code): `custom_lm_studio` (lowercase, used in factory)
- **Display name**: "LM Studio" (as entered by user)

## Backend Architecture

### Config Module (`src/config.py`)

Add function to scan and load custom providers:

```python
import re
from typing import List, Dict

def _slugify_provider_name(name: str) -> str:
    """Convert provider name to env-var-safe ID."""
    slug = re.sub(r'[^a-zA-Z0-9]+', '_', name.strip())
    return slug.strip('_').upper()

def load_custom_providers() -> List[Dict]:
    """Scan .env for CUSTOM_PROVIDER__{ID}__NAME entries."""
    providers = []
    
    for key, value in os.environ.items():
        if not key.startswith('CUSTOM_PROVIDER__'):
            continue
        parts = key.split('__')
        if len(parts) != 3 or parts[2] != 'NAME':
            continue
        
        provider_id = parts[1]
        prefix = f'CUSTOM_PROVIDER__{provider_id}__'
        
        providers.append({
            'id': f'custom_{provider_id.lower()}',
            'slug': provider_id,
            'name': value,
            'endpoint': os.getenv(f'{prefix}ENDPOINT', ''),
            'api_key': os.getenv(f'{prefix}API_KEY', ''),
            'model': os.getenv(f'{prefix}MODEL', ''),
        })
    return providers

CUSTOM_PROVIDERS: List[Dict] = []  # Populated at startup and on reload
```

Add to `_RELOADABLE_ENV_SETTINGS` handling so `reload_config()` refreshes the list.

### Factory Module (`src/core/llm/factory.py`)

Extend `create_llm_provider()` to handle custom providers:

```python
from src.config import CUSTOM_PROVIDERS

def create_llm_provider(provider_type: str = "ollama", **kwargs) -> LLMProvider:
    # ... existing provider cases ...
    
    # Handle custom_* providers
    if provider_type.startswith('custom_'):
        custom_cfg = next(
            (p for p in CUSTOM_PROVIDERS if p['id'] == provider_type),
            None
        )
        if not custom_cfg:
            raise ValueError(f"Unknown custom provider: {provider_type}")
        
        return OpenAICompatibleProvider(
            api_endpoint=kwargs.get('api_endpoint') or custom_cfg['endpoint'],
            model=kwargs.get('model') or custom_cfg['model'],
            api_key=kwargs.get('api_key') or custom_cfg['api_key'],
            provider_name=custom_cfg['name'],
        )
    
    raise ValueError(f"Unknown provider type: {provider_type}")
```

No new provider class needed - custom providers reuse `OpenAICompatibleProvider`.

## API Endpoints

### `GET /api/custom-providers`

Returns list of configured custom providers (API keys masked):

```json
{
  "providers": [
    {
      "id": "custom_lm_studio",
      "slug": "LM_STUDIO",
      "name": "LM Studio",
      "endpoint": "http://localhost:1234/v1/chat/completions",
      "model": "local-model",
      "has_api_key": false
    }
  ]
}
```

### `POST /api/custom-providers`

Add a new custom provider.

**Request:**
```json
{
  "name": "My Server",
  "endpoint": "http://localhost:8000/v1/chat/completions",
  "api_key": "",
  "model": "llama-3-70b"
}
```

**Response:**
```json
{
  "id": "custom_my_server",
  "slug": "MY_SERVER"
}
```

### `PUT /api/custom-providers/{slug}`

Update existing provider fields.

**Request:**
```json
{
  "endpoint": "http://new-server:8000/v1/chat/completions",
  "model": "new-model"
}
```

### `DELETE /api/custom-providers/{slug}`

Remove provider from .env.

### `POST /api/custom-providers/{slug}/test`

Test connection to the provider's endpoint.

**Response:**
```json
{
  "success": true,
  "message": "Connected successfully",
  "model_count": 5
}
```

Or on failure:
```json
{
  "success": false,
  "error": "Connection refused"
}
```

### `GET /api/models?provider=custom_lm_studio`

Existing endpoint extended to fetch models from custom provider's `/v1/models` endpoint.

## Frontend Architecture

### Provider Dropdown

Custom providers appear at the end of the main `#llmProvider` dropdown, sorted alphabetically by name:

```html
<select id="llmProvider">
  <!-- Built-in providers (fixed order) -->
  <option value="ollama">Ollama</option>
  <option value="openai">OpenAI</option>
  <!-- ... -->
  
  <!-- Custom providers (alphabetical by name, after built-ins) -->
  <option value="custom_company_api">Custom: Company API</option>
  <option value="custom_lm_studio">Custom: LM Studio</option>
</select>
```

### Settings Panel

When a custom provider is selected, reuse the OpenAI settings panel:
- Endpoint field (pre-filled from saved config, editable)
- API Key field (optional)
- Model dropdown (auto-fetch with manual fallback)

### Management Modal

"Manage Custom Providers" button appears below the provider dropdown (next to the refresh button). It opens a modal with:
- List of existing custom providers
- Add new provider form (name, endpoint, API key, model)
- Edit button per provider
- Delete button with confirmation
- Test Connection button

### Files to Modify

- `src/web/static/js/providers/provider-manager.js` - Add custom provider handling
- `src/web/static/js/providers/custom-provider-modal.js` - New file for management UI
- `src/web/templates/index.html` - Add modal markup and management button

### i18n Keys (all 7 locales)

```
settings:custom_providers_manage = "Manage Custom Providers"
settings:custom_provider_add = "Add Custom Provider"
settings:custom_provider_edit = "Edit Provider"
settings:custom_provider_delete = "Delete Provider"
settings:custom_provider_name = "Provider Name"
settings:custom_provider_name_placeholder = "e.g., LM Studio"
settings:custom_provider_endpoint = "API Endpoint"
settings:custom_provider_endpoint_placeholder = "http://localhost:1234/v1/chat/completions"
settings:custom_provider_test = "Test Connection"
settings:custom_provider_test_success = "Connected successfully"
settings:custom_provider_test_failed = "Connection failed: {{error}}"
settings:custom_provider_delete_confirm = "Delete provider '{{name}}'? This cannot be undone."
settings:custom_provider_duplicate = "A provider with this name already exists"
settings:custom_provider_saved = "Provider saved successfully"
```

## Validation Rules

| Field | Required | Rules |
|-------|----------|-------|
| Name | Yes | 1-50 chars, must produce valid slug (at least one alphanumeric) |
| Endpoint | Yes | Valid URL, must start with `http://` or `https://` |
| API Key | No | Any string, can be empty for local servers |
| Model | No | Any string, can be empty (user selects from list or types manually) |

## Error Handling

### Duplicate Names
Reject with error if slug already exists: "A provider with this name already exists"

### Model Fetching
- Timeout: 3 seconds
- On failure: Show warning, enable manual model input field
- Cache fetched models for 5 minutes

### Provider Deletion
- Block if translation in progress using this provider
- Show confirmation dialog before deletion

### .env Write Failures
- Show clear error message if file permissions prevent write
- Suggest manual .env editing as fallback

## Migration

No migration needed. Feature is purely additive - existing users see no change until they add custom providers.

## Testing

### Unit Tests
- `test_slugify_provider_name()` - Various name formats
- `test_load_custom_providers()` - Parse .env correctly
- `test_create_llm_provider_custom()` - Factory returns correct provider

### Integration Tests
- Add/edit/delete custom provider via API
- Model fetching from custom endpoint
- Translation using custom provider

### Manual Testing
- Add LM Studio as custom provider
- Verify model fetching works
- Run test translation
- Delete provider, verify cleanup
