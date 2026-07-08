# Lume - Google Extension

![Editor](https://img.shields.io/badge/Editor-VS_Code-blue?style=for-the-badge&logo=visual-studio-code&logoColor=white)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)
![Manifest](https://img.shields.io/badge/Manifest-V3-green?style=for-the-badge)
![AI](https://img.shields.io/badge/AI-Google_Gemini-blue?style=for-the-badge&logo=google&logoColor=white)
![DataBase](https://img.shields.io/badge/DB-MongoDB_Atlas-green?style=for-the-badge&logo=mongodb&logoColor=white)
![Privacy](https://img.shields.io/badge/Privacy-Zero_Knowledge-brightgreen?style=for-the-badge)

It is a Chrome extension that analyzes Google search results in real time using AI and rates the quality of each source with a colored visual badge. The goal is to help users immediately distinguish authoritative sources from low-quality content, SEO spam, or disguised advertising.

## Version
> 1.2.0 beta

## License
**MIT License - Copyright (c) 2026 Luca Bracaloni**


## Contents
- [Technologies](#Technologies)
- [Features](#Features)
- [Requirements](#Requirements)
- [Manifest V3 Permission](#Manifest-v3-permission)
- [API Google Gemini](#Api-gemini)
- [Storage & Persistence](#Storage-e-persistence)
- [Contact](#Contact)


## Technologies used
- **Engine**: Chrome Extensions API (Manifest V3)
- **Intelligence**: Google Gemini API (gemini-3.1-flash-lite)
- **Local Storage**: chrome.storage.local (Privacy-first, local-only storage)
- **Persistance Storage**: MongoDB Atlas
- **Version Control**: Github


## Features
- AI-Powered Analysis - Scans Google Search results in real-time to identify content quality
- Intelligent Badging
- Efficiency Optimized - Uses the high-speed Free Gemini gemini-3.1-flash-lite model to ensure zero lag during browsing.


## Requirements

| Tool              | Version         |
|-------------------|-----------------|
| Chrome / Edge     | Latest stable   |
| GEMINI API Key |  /                 |


## Manifest V3 Permission

### Declared Permission

| Permission     | Usage                                                                            |
|--------------|-------------------------------------------------------------------------------------|
| `storage`    | `chrome.storage.local` to persist `filterEnabled`, `hiddenCategories` |
| `activeTab`  | Access to the current tab for the popup                                              |
| `tabs`       | `chrome.tabs.query` in the popup to send messages to the active content script         |

### Host permissions

| Pattern                                      | Reason                                |
|----------------------------------------------|---------------------------------------|
| `https://www.google.{com,it,co.uk,de,fr,es}/*`| Inject content script + styles.css |
| `https://generativelanguage.googleapis.com/*` | Fetch calls from the service worker  |


## API Anthropic

### Endpoint

```
POST https://generativelanguage.googleapis.com/messages
```

### Headers

```
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods':'POST,PATCH,OPTIONS',
  'X-Lume-Client': 'extension-v1.0'
```

### Model LLM

```
gemini-3.1-flash-lite
```

Gemini 3.1 Flash-Lite is a low-latency, cost-effective multimodal model optimized for high-frequency, lightweight tasks. The model supports text, image, video, audio, and PDF inputs, and is designed for high-volume agentic workflows, simple data extraction, and applications where latency and API cost are the primary constraints.


## Storage & Persistence

All settings use `chrome.storage.local` (synced across Chrome devices linked to the same Google account).

| Key | Type | Default | Description |
|--------|------|---------|-------------|
| `filterEnabled` | `boolean` | `true` | Global toggle extension |
| `hiddenCategories` | `string[]` | `[]` | Array for category ID to hidden |

MongoDB Atlas is used to store the processed search results returned by the model in order to build a data collection 

---

## Contact
- **Email**: luca.bracaloni87@gmail.com
- **LinkedIn**: https://www.linkedin.com/in/luca-bracaloni-ba7346250/
- **Website**: https://www.lucabracaloni.it/