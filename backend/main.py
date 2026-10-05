import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles

from backend.api.auth import auth_error_handler, router as auth_router
from backend.api.courses import course_error_handler, router as courses_router
from backend.api.runs import router as runs_router, run_error_handler
from backend.api.settings import router as settings_router, settings_error_handler
from backend.api.uploads import router as uploads_router, upload_error_handler
from backend.core.config import validate_config
from backend.core.courses import CourseError
from backend.core.model_settings import SettingsError
from backend.core.runs import RunError
from backend.core.uploads import UploadError
from backend.core.weak_auth import AuthError
from backend.pipelines.html_to_pdf import PlaywrightPdfConverter
from backend.storage.sqlite import SQLiteRepository

LOCAL_CORS_ORIGINS = [
    "http://localhost:14242",
    "http://127.0.0.1:14242",
    "http://localhost:14243",
    "http://127.0.0.1:14243",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
]


@asynccontextmanager
async def lifespan(_app: FastAPI):
    _app.state.pdf_converter = PlaywrightPdfConverter()
    if not os.getenv("TESTING"):
        validate_config()
        SQLiteRepository.from_path()
        print("SQLite metadata store is ready.")
    yield


app = FastAPI(title="AI Learning Assistant Backend", lifespan=lifespan)
app.add_exception_handler(AuthError, auth_error_handler)
app.add_exception_handler(CourseError, course_error_handler)
app.add_exception_handler(RunError, run_error_handler)
app.add_exception_handler(SettingsError, settings_error_handler)
app.add_exception_handler(UploadError, upload_error_handler)
app.include_router(auth_router)
app.include_router(courses_router)
app.include_router(runs_router)
app.include_router(settings_router)
app.include_router(uploads_router)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=LOCAL_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

static_path = os.path.join(os.path.dirname(__file__), "static")
if not os.path.exists(static_path):
    os.makedirs(static_path)
app.mount("/ui", StaticFiles(directory=static_path, html=True), name="ui")


@app.get("/")
def root():
    return RedirectResponse(url="/ui")


@app.get("/health")
def health_check():
    return {"status": "ok"}
