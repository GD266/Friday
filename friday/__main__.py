"""Friday entrypoint — FastAPI server + CLI.

Run:
    python -m friday              # start API server
    python -m friday --help
    friday                        # via console script
"""

from __future__ import annotations

import argparse
import asyncio
import sys

from pydantic import BaseModel

from friday.config import get_settings
from friday.utils.logging import configure_logging, get_logger

logger = get_logger(__name__)


class ChatInModel(BaseModel):
    """Request body for /chat."""

    message: str
    session_id: str = "default"
    provider: str | None = None
    stream: bool = False


class HealthOutModel(BaseModel):
    status: str
    provider: str
    provider_healthy: bool
    memory_count: int


def build_app():
    """Create FastAPI app (imported lazily so CLI doesn't require fastapi)."""
    from fastapi import FastAPI, HTTPException
    from fastapi.middleware.cors import CORSMiddleware

    from friday.agent import AgentRequest, FridayAgent

    app = FastAPI(
        title="Friday API",
        version="0.1.0",
        description="Desktop AI Assistant — Python backend",
    )

    # CORS for Tauri dev server (localhost) and file://
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health")
    async def health() -> dict:
        agent = FridayAgent()
        return await agent.health_check()

    @app.post("/chat")
    async def chat(body: ChatInModel) -> dict:
        if not body.message.strip():
            raise HTTPException(status_code=400, detail="message must not be empty")
        agent = FridayAgent(provider_name=body.provider)
        try:
            resp = await agent.chat(AgentRequest(message=body.message, session_id=body.session_id, provider=body.provider))
        except Exception as exc:
            logger.exception("Chat failed")
            raise HTTPException(status_code=500, detail=str(exc)) from exc
        return {"content": resp.content, "provider": resp.provider, "model": resp.model, "session_id": resp.session_id}

    @app.get("/")
    async def root() -> dict:
        return {"name": "Friday", "version": "0.1.0", "status": "ok", "docs": "/docs"}

    return app


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(prog="friday", description="Friday — Desktop AI Assistant")
    parser.add_argument("--host", default=None, help="Host to bind (default from env FRIDAY_HOST)")
    parser.add_argument("--port", type=int, default=None, help="Port to bind (default from env FRIDAY_PORT)")
    parser.add_argument("--reload", action="store_true", help="Enable auto-reload (dev)")
    parser.add_argument("--check", action="store_true", help="Run health check and exit")
    args = parser.parse_args(argv)

    settings = get_settings()
    configure_logging(settings.log_level)

    if args.check:
        async def _check():
            from friday.agent import FridayAgent

            agent = FridayAgent()
            result = await agent.health_check()
            print(result)

        asyncio.run(_check())
        return

    host = args.host or settings.host
    port = args.port or settings.port

    logger.info("Starting Friday backend on %s:%s (provider=%s, env=%s)", host, port, settings.provider, settings.env)

    import uvicorn

    app = build_app()
    uvicorn.run(app, host=host, port=port, reload=args.reload, log_level=settings.log_level.lower())


if __name__ == "__main__":
    main()
