# Lume - Google Extension

[![Visual Studio](https://img.shields.io/badge/Visual%20Studio-5C2D91?style=for-the-badge&logo=visualstudio&logoColor=white)](#)
![License](https://img.shields.io/badge/License-All_Rights_Reserved-red?style=for-the-badge)
![Manifest](https://img.shields.io/badge/Manifest-V3-green?style=for-the-badge)
![AI](https://img.shields.io/badge/AI-Anthropic_Claude-blue?style=for-the-badge&logo=anthropic&logoColor=white)
![Privacy](https://img.shields.io/badge/Privacy-Zero_Knowledge-brightgreen?style=for-the-badge)

It is a Chrome extension that analyzes Google search results in real time using AI and rates the quality of each source with a colored visual badge. The goal is to help users immediately distinguish authoritative sources from low-quality content, SEO spam, or disguised advertising.

## Version
> 1.0.0 beta

## License
**All rights reserved**


## Contents
- [Technologies](#Technologies)
- [Features](#Features)
- [Requirements](#Requirements)
- [Manifest V3 Permission](#Manifest-v3-permission)
- [API Anthropic](#Api-anthropic)
- [Storage & Persistence](#Storage-e-persistence)
- [Security](#Security)
- [Contact](#Contact)


## Technologies used
- **Engine**: Chrome Extensions API (Manifest V3)
- **Intelligence**: Anthropic Claude (Haiku Model)
- **Storage**: chrome.storage.local (Privacy-first, local-only storage)
- **Version Control**: Github


## Features
- AI-Powered Analysis - Scans Google Search results in real-time to identify content quality
- Intelligent Badging
- Privacy-Centric - No central database. All API calls are made directly from the client to Anthropic.
- Zero-Knowledge Architecture - Your search history and API keys never touch servers.
- Efficiency Optimized - Uses the high-speed Claude Haiku model to ensure zero lag during browsing.


## Requirements

| Tool              | Version         |
|-------------------|-----------------|
| Chrome / Edge     | Latest stable   |
| Anthropic API Key | /               |


## Manifest V3 Permission

### Declared Permission

| Permission     | Usage                                                                            |
|--------------|-------------------------------------------------------------------------------------|
| `storage`    | `chrome.storage.local` to persist `apiKey`, `filterEnabled`, `hiddenCategories` |
| `activeTab`  | Access to the current tab for the popup                                              |
| `tabs`       | `chrome.tabs.query` in the popup to send messages to the active content script         |

### Host permissions

| Pattern                                      | Reason                                |
|----------------------------------------------|---------------------------------------|
| `https://www.google.{com,it,co.uk,de,fr,es}/*`| Inject content script + styles.css |
| `https://api.anthropic.com/*`                | Fetch calls from the service worker     |


## API Anthropic

### Endpoint

```
POST https://api.anthropic.com/v1/messages
```

### Headers

```
Content-Type: application/json
x-api-key: <apikey>
anthropic-version: 2023-06-01
anthropic-dangerous-direct-browser-access: true
```

The `anthropic-dangerous-direct-browser-access` header is required by Anthropic to authorize direct calls from the browser (this is necessary because the service worker is not a traditional server).

### Model LLM

```
claude-haiku-4-5-20251001
```

Haiku is Anthropic's fastest and most cost-effective model. It is suitable for batch classification tasks where latency is noticeable to the user.

### Payload

```json
{
  "model": "claude-haiku-4-5-20251001",
  "max_tokens": 1200,
  "system": "...",
  "messages": [{
    "role": "user",
    "content": "Analyze these search results:\n[{\"title\":\"...\",\"domain\":\"...\",\"snippet\":\"...\"}]"
  }]
}
```

`max_tokens: 1200` is sufficient for ~10 JSON response objects. With 10 results, each object takes up ~60 tokens.

Each Google search uses about 1–2 API calls to Claude. With Anthropic’s pay-per-use plan, the cost is just a few cents for hundreds of queries.


## Storage & Persistence

All settings use `chrome.storage.local` (synced across Chrome devices linked to the same Google account).

| Key | Type | Default | Description |
|--------|------|---------|-------------|
| `apiKey` | `string` | — | User's Anthropic API key |
| `filterEnabled` | `boolean` | `true` | Global toggle extension |
| `hiddenCategories` | `string[]` | `[]` | Array for category ID to hidden |

---

## Security

The API key is stored locally in your browser using `chrome.storage.local`. 
Only the following are sent to Anthropic: title, domain, and snippet (no full URL, no personal data).

| Aspetto | Implementazione |
|---------|----------------|
| **API KEY** | Never in the source code. Stored in `chrome.storage.local`, encrypted by Chrome, and inaccessible from external web pages |
| **Data sent to Anthropic** | Only `title`, `domain`, `snippet` — no full URLs, no cookies, no personally identifiable user data |
| **Input Validation** | The `sk-ant-` format is validated in the popup before saving. The key is never logged. |
| **CSS Isolation** | Shadow DOM `mode: open` prevents bidirectional interference with Google |
| **CORS** | No fetch requests from the content script to external domains. Everything goes through the service worker. |
| **Permission Scopes** | `activeTab` and `tabs` instead of `<all_urls>`. `host_permissions` limited to only the necessary Google domains |

## Contact
- **Email**: luca.bracaloni87@gmail.com
- **LinkedIn**: https://www.linkedin.com/in/luca-bracaloni-ba7346250/
- **Website**: https://www.lucabracaloni.it/