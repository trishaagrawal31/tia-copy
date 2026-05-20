from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from app.database import Base, engine
from app.routers import users, tia_profiles, projects, tasks, conversations, streaks, badges
from app.routers import auth

# Import all models so Base.metadata knows about every table
import app.models  # noqa: F401


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create all tables on startup (safe to call repeatedly — skips existing tables)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield


# Custom middleware to preserve Authorization header on redirects
class AuthHeaderMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        # If it's a redirect, add the original Authorization header info
        if response.status_code in (307, 308):
            auth_header = request.headers.get("Authorization")
            if auth_header:
                response.headers["X-Original-Authorization"] = auth_header
        return response


app = FastAPI(
    title="TIA - The Innovative Assistant", 
    version="0.1.0", 
    lifespan=lifespan,
    redirect_slashes=False,  # Disable automatic trailing slash redirects
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users.router, prefix="/api")
app.include_router(tia_profiles.router, prefix="/api")
app.include_router(projects.router, prefix="/api")
app.include_router(tasks.router, prefix="/api")
app.include_router(conversations.router, prefix="/api")
app.include_router(streaks.router, prefix="/api")
app.include_router(badges.router, prefix="/api")
app.include_router(auth.router, prefix="/api")


@app.get("/health")
async def health():
    return {"status": "ok"}
