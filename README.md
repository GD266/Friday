# Friday — Desktop AI Assistant

> Foundation build — clean, modular, production-oriented scaffold. Voice, AI reasoning, computer control, and advanced UI are intentionally stubbed for later milestones.

Friday is a desktop assistant with:
- **Python** backend (`friday/` package) — agent, providers, tools, memory, voice & computer-control stubs
- **Tauri + React + TypeScript** desktop shell (`src/` + `src-tauri/`) — talks to the Python backend over HTTP
- Provider abstraction so the LLM can be swapped without touching agent code
- Env-based config (`.env`), structured logging, and typed error hierarchy

---

## Project Structure

```
Friday/
├── friday/                  # Python package (backend)
│   ├── agent/               # FridayAgent orchestration (provider-agnostic)
│   │   ├── agent.py
│   │   └── types.py
│   ├── providers/           # AI provider abstraction
│   │   ├── base.py          # Provider interface (chat / stream / health_check)
│   │   ├── registry.py      # ProviderRegistry
│   │   └── mock.py          # MockProvider (no keys, deterministic)
│   ├── tools/               # Tool abstraction + registry (future: web, fs, etc.)
│   │   ├── base.py
│   │   └── registry.py
│   ├── voice/               # STT/TTS abstraction (stub)
│   ├── computer_control/    # Mouse/keyboard/window control (stub, sandboxed)
│   ├── memory/              # MemoryStore (JSON-backed, swappable)
│   ├── config/              # Settings (pydantic-settings, .env support)
│   │   └── settings.py
│   ├── utils/               # logging, errors
│   └── __main__.py          # FastAPI server + CLI
├── src/                     # React frontend (Vite)
│   ├── components/          # Header, BackendStatus, ChatPlaceholder
│   ├── hooks/               # useHealth
│   ├── types/               # shared types
│   ├── utils/               # api client
│   ├── styles/
│   ├── App.tsx
│   └── main.tsx
├── src-tauri/               # Tauri (Rust) shell
│   ├── src/
│   │   ├── main.rs
│   │   └── lib.rs           # Tauri commands (greet, get_version)
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── icons/
├── tests/                   # pytest suite
├── pyproject.toml
├── package.json
├── vite.config.ts
├── tsconfig.json
├── .env.example
└── README.md
```

### Separation of Concerns

| Layer | Path | Responsibility | Depends on |
|---|---|---|---|
| agent | `friday/agent/` | Orchestration, session handling | providers, memory, tools |
| providers | `friday/providers/` | LLM abstraction (chat/stream/health) | nothing (interface) |
| tools | `friday/tools/` | Extensible tool calling | nothing (interface) |
| voice | `friday/voice/` | STT/TTS abstraction | nothing |
| computer_control | `friday/computer_control/` | Desktop automation (sandboxed) | nothing |
| memory | `friday/memory/` | Conversation/history persistence | config |
| config | `friday/config/` | Env + `.env` → typed `Settings` | — |
| utils | `friday/utils/` | `logging`, `errors` | — |
| UI | `src/` | React shell, calls `http://127.0.0.1:8000` | backend HTTP |
| shell | `src-tauri/` | Native window, bundling | — |

No layer imports secrets directly — all credentials flow through `Settings`.

---

## Requirements

- **Python** 3.10+ (tested on 3.14)
- **Node** 18+ / npm 10+
- **Rust** 1.77+ + Cargo (for Tauri)
- On Windows: [WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) (usually preinstalled) + [Tauri prerequisites](https://tauri.app/start/prerequisites/)

---

## Quick Start

### 1. Clone & env

```powershell
git clone <repo> Friday
cd Friday
copy .env.example .env
# edit .env — no keys required for mock provider
```

`.env.example` documents every variable. Secrets are **never** hardcoded — they are read from env/`.env` via `pydantic-settings`. `FRIDAY_PROVIDER=mock` works out of the box.

### 2. Python backend

```powershell
# create venv (recommended)
python -m venv .venv
.\.venv\Scripts\Activate.ps1

pip install -e ".[dev]"

# health check without starting server
python -m friday --check

# start API server (http://127.0.0.1:8000, docs at /docs)
python -m friday
# or with auto-reload:
python -m friday --reload
```

Environment variables:

| Var | Purpose | Default |
|---|---|---|
| `FRIDAY_PROVIDER` | `mock` \| `openai` \| `anthropic` \| `openrouter` \| `ollama` \| `gemini` | `mock` |
| `FRIDAY_ENV` | `development` \| `production` \| `test` | `development` |
| `FRIDAY_LOG_LEVEL` | `DEBUG`…`CRITICAL` | `INFO` |
| `FRIDAY_HOST` / `FRIDAY_PORT` | Backend bind | `127.0.0.1:8000` |
| `OPENAI_API_KEY` etc. | Provider credentials | — (only needed if that provider is selected) |

### 3. Desktop UI (Tauri)

```powershell
npm install

# web-only dev (no Rust needed)
npm run dev
# → http://127.0.0.1:1420

# full Tauri window (needs Rust + backend running)
npm run tauri dev

# or run both side-by-side:
# terminal 1: python -m friday
# terminal 2: npm run tauri dev
```

Frontend config:

| Var | Purpose | Default |
|---|---|---|
| `VITE_FRIDAY_API_URL` | Python backend URL | `http://127.0.0.1:8000` |

### 4. Tests

```powershell
pytest -v
# or
python -m pytest -v
```

---

## Provider Abstraction

Add a new provider without touching the agent:

```python
# friday/providers/openai.py
from friday.providers.base import Provider, ChatMessage, ChatResponse

class OpenAIProvider(Provider):
    name = "openai"
    async def chat(self, messages, **kw): ...
    async def stream(self, messages, **kw): ...
    async def health_check(self): ...

# register at startup
from friday.providers.registry import get_registry
get_registry().register(OpenAIProvider(api_key=settings.openai_api_key))
```

Switch via env: `FRIDAY_PROVIDER=openai`.

---

## Logging

```python
from friday.utils.logging import get_logger, configure_logging

configure_logging("DEBUG")  # or rely on FRIDAY_LOG_LEVEL
logger = get_logger(__name__)
logger.info("hello", extra={"session_id": "abc"})
```

Format: `YYYY-MM-DD HH:MM:SS | LEVEL | logger | message` to stdout.

## Error Handling

All domain errors extend `FridayError` (`friday/utils/errors.py`):

- `ConfigurationError` — bad/missing config
- `ProviderError` / `ProviderNotFoundError`
- `ToolError` / `ToolNotFoundError`
- `MemoryError`, `VoiceError`, `ComputerControlError`

Catch broadly (`except FridayError`) or narrowly.

---

## What’s Stubbed (by design)

- **Voice** (`friday/voice/`) — `StubVoiceInterface` returns “not implemented”. Real STT/TTS will implement `VoiceInterface`.
- **Computer control** (`friday/computer_control/`) — `StubComputerControl` is sandboxed (`FRIDAY_COMPUTER_CONTROL_SANDBOX=true` blocks all actions).
- **AI reasoning / tool calling** — `FridayAgent` delegates to the provider; agentic loop & tool orchestration comes next milestone.
- **Advanced UI** — `ChatPlaceholder` is a minimal chat wired to `/chat`; theming, streaming UI, and system tray come later.

---

## Troubleshooting

- **Backend offline in UI** — ensure `python -m friday` is running and `VITE_FRIDAY_API_URL` matches `FRIDAY_HOST:FRIDAY_PORT`.
- **Tauri fails to build** — run `rustc --version` and check https://tauri.app/start/prerequisites/. On Windows, ensure WebView2 + `cargo` are installed.
- **`OPENAI_API_KEY` etc. not picked up** — confirm `.env` is at project root and that `FRIDAY_PROVIDER` matches the key you set.
- **Port in use** — change `FRIDAY_PORT` in `.env` and `VITE_FRIDAY_API_URL` accordingly.

---

## License

MIT
