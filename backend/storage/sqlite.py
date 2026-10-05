from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sqlalchemy import (
    CheckConstraint,
    Column,
    ForeignKey,
    Integer,
    MetaData,
    Table,
    Text,
    create_engine,
    event,
    select,
    update,
)
from sqlalchemy.engine import Engine

SCHEMA_VERSION = 4
SQLITE_PATH_ENV = "APP_SQLITE_PATH"
DEFAULT_SQLITE_PATH = Path("data/app.sqlite")

metadata = MetaData()

users = Table(
    "users",
    metadata,
    Column("id", Text, primary_key=True),
    Column("email", Text, nullable=False, unique=True),
    Column("role", Text, nullable=False),
    Column("password_hash", Text, nullable=False),
    Column("created_at", Text, nullable=False),
    CheckConstraint("role in ('teacher', 'student')", name="users_role_check"),
)

sessions = Table(
    "sessions",
    metadata,
    Column("id", Text, primary_key=True),
    Column("user_id", Text, ForeignKey("users.id"), nullable=False),
    Column("token_hash", Text, nullable=False),
    Column("expires_at", Text, nullable=True),
    Column("created_at", Text, nullable=False),
)

model_profiles = Table(
    "model_profiles",
    metadata,
    Column("id", Text, primary_key=True),
    Column("user_id", Text, ForeignKey("users.id"), nullable=True),
    Column("display_name", Text, nullable=False),
    Column("provider", Text, nullable=False),
    Column("base_url", Text, nullable=False),
    Column("model", Text, nullable=False),
    Column("api_key_ref", Text, nullable=True),
    Column("context_window_hint", Integer, nullable=True),
    Column("supports_streaming", Integer, nullable=False),
    Column("is_default", Integer, nullable=False),
    Column("created_at", Text, nullable=False),
    Column("updated_at", Text, nullable=False),
    CheckConstraint("supports_streaming in (0, 1)", name="model_profiles_streaming_check"),
    CheckConstraint("is_default in (0, 1)", name="model_profiles_default_check"),
)

projects = Table(
    "projects",
    metadata,
    Column("id", Text, primary_key=True),
    Column("user_id", Text, ForeignKey("users.id"), nullable=False),
    Column("title", Text, nullable=False),
    Column("root_path", Text, nullable=False),
    Column("is_default", Integer, nullable=False, default=0),
    Column("is_archived", Integer, nullable=False, default=0),
    Column("context_enabled", Integer, nullable=False, default=1),
    Column("context_path", Text, nullable=True),
    Column("context_updated_at", Text, nullable=True),
    Column("created_at", Text, nullable=False),
    Column("updated_at", Text, nullable=False),
    CheckConstraint("is_default in (0, 1)", name="projects_default_check"),
    CheckConstraint("is_archived in (0, 1)", name="projects_archived_check"),
    CheckConstraint("context_enabled in (0, 1)", name="projects_context_enabled_check"),
)

runs = Table(
    "runs",
    metadata,
    Column("id", Text, primary_key=True),
    Column("project_id", Text, ForeignKey("projects.id"), nullable=True),
    Column("user_id", Text, ForeignKey("users.id"), nullable=False),
    Column("intent", Text, nullable=False),
    Column("task_text", Text, nullable=False),
    Column("search_mode", Text, nullable=False),
    Column("status", Text, nullable=False),
    Column("model_profile_id", Text, ForeignKey("model_profiles.id"), nullable=True),
    Column("revision_of_run_id", Text, nullable=True),
    Column("output_root", Text, nullable=True),
    Column("error_message", Text, nullable=True),
    Column("created_at", Text, nullable=False),
    Column("updated_at", Text, nullable=False),
    CheckConstraint("search_mode in ('auto', 'on', 'off')", name="runs_search_mode_check"),
    CheckConstraint(
        "status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')",
        name="runs_status_check",
    ),
)

uploads = Table(
    "uploads",
    metadata,
    Column("id", Text, primary_key=True),
    Column("user_id", Text, ForeignKey("users.id"), nullable=True),
    Column("run_id", Text, ForeignKey("runs.id"), nullable=True),
    Column("original_name", Text, nullable=False),
    Column("media_type", Text, nullable=True),
    Column("stored_path", Text, nullable=False),
    Column("sha256", Text, nullable=False),
    Column("size_bytes", Integer, nullable=False),
    Column("created_at", Text, nullable=False),
)

artifacts = Table(
    "artifacts",
    metadata,
    Column("id", Text, primary_key=True),
    Column("run_id", Text, ForeignKey("runs.id"), nullable=False),
    Column("kind", Text, nullable=False),
    Column("path", Text, nullable=False),
    Column("media_type", Text, nullable=True),
    Column("created_at", Text, nullable=False),
)

citations = Table(
    "citations",
    metadata,
    Column("id", Text, primary_key=True),
    Column("run_id", Text, ForeignKey("runs.id"), nullable=False),
    Column("title", Text, nullable=True),
    Column("url", Text, nullable=True),
    Column("snippet", Text, nullable=True),
    Column("created_at", Text, nullable=False),
)


def resolve_sqlite_path(path: str | os.PathLike[str] | None = None) -> Path:
    configured_path = path or os.getenv(SQLITE_PATH_ENV) or DEFAULT_SQLITE_PATH
    return Path(configured_path)


def create_sqlite_engine(path: str | os.PathLike[str] | None = None) -> Engine:
    db_path = resolve_sqlite_path(path)
    if str(db_path) == ":memory:":
        url = "sqlite+pysqlite:///:memory:"
    else:
        db_path.parent.mkdir(parents=True, exist_ok=True)
        url = f"sqlite+pysqlite:///{db_path}"

    engine = create_engine(url, future=True)

    @event.listens_for(engine, "connect")
    def _enable_foreign_keys(dbapi_connection: Any, _connection_record: Any) -> None:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    return engine


def get_schema_version(engine: Engine) -> int:
    with engine.connect() as connection:
        return int(connection.exec_driver_sql("PRAGMA user_version").scalar_one())


def initialize_database(engine: Engine) -> None:
    current_version = get_schema_version(engine)
    if current_version > SCHEMA_VERSION:
        raise RuntimeError(
            f"SQLite schema version {current_version} is newer than supported {SCHEMA_VERSION}."
        )

    metadata.create_all(engine)

    if current_version == 0:
        with engine.begin() as connection:
            _ensure_course_default_index(connection)
            connection.exec_driver_sql(f"PRAGMA user_version = {SCHEMA_VERSION}")
        return

    if current_version < 2:
        with engine.begin() as connection:
            _migrate_1_to_2(connection)
            current_version = 2

    if current_version < 3:
        with engine.begin() as connection:
            _migrate_2_to_3(connection)
            current_version = 3

    if current_version < 4:
        with engine.begin() as connection:
            _migrate_3_to_4(connection)
            connection.exec_driver_sql("PRAGMA user_version = 4")


def _migrate_1_to_2(connection: Any) -> None:
    columns = {
        row._mapping["name"]
        for row in connection.exec_driver_sql("PRAGMA table_info(runs)").all()
    }
    if "revision_of_run_id" not in columns:
        connection.exec_driver_sql("ALTER TABLE runs ADD COLUMN revision_of_run_id text")


def _migrate_2_to_3(connection: Any) -> None:
    columns = {
        row._mapping["name"]
        for row in connection.exec_driver_sql("PRAGMA table_info(uploads)").all()
    }
    if "user_id" not in columns:
        connection.exec_driver_sql("ALTER TABLE uploads ADD COLUMN user_id text")


def _migrate_3_to_4(connection: Any) -> None:
    columns = {
        row._mapping["name"]
        for row in connection.exec_driver_sql("PRAGMA table_info(projects)").all()
    }
    additions = {
        "is_default": "integer NOT NULL DEFAULT 0",
        "is_archived": "integer NOT NULL DEFAULT 0",
        "context_enabled": "integer NOT NULL DEFAULT 1",
        "context_path": "text",
        "context_updated_at": "text",
    }
    for name, definition in additions.items():
        if name not in columns:
            connection.exec_driver_sql(
                f"ALTER TABLE projects ADD COLUMN {name} {definition}"
            )

    now = _now()
    user_ids = connection.exec_driver_sql("SELECT id FROM users").scalars().all()
    for user_id in user_ids:
        has_default = connection.exec_driver_sql(
            "SELECT 1 FROM projects WHERE user_id = ? AND is_default = 1 LIMIT 1",
            (user_id,),
        ).first()
        if has_default:
            continue
        values = _default_project_values(str(user_id), now=now)
        connection.exec_driver_sql(
            """
            INSERT INTO projects (
                id, user_id, title, root_path, is_default, is_archived,
                context_enabled, context_path, context_updated_at, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                values["id"],
                values["user_id"],
                values["title"],
                values["root_path"],
                values["is_default"],
                values["is_archived"],
                values["context_enabled"],
                values["context_path"],
                values["context_updated_at"],
                values["created_at"],
                values["updated_at"],
            ),
        )
    _ensure_course_default_index(connection)


def _ensure_course_default_index(connection: Any) -> None:
    connection.exec_driver_sql(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS uq_projects_user_default
        ON projects(user_id)
        WHERE is_default = 1
        """
    )


def _now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _new_id() -> str:
    return str(uuid.uuid4())


def _new_course_id() -> str:
    return f"course_{uuid.uuid4().hex}"


def _default_project_values(user_id: str, *, now: str | None = None) -> dict[str, Any]:
    timestamp = now or _now()
    course_id = _new_course_id()
    return {
        "id": course_id,
        "user_id": user_id,
        "title": "Just Asking",
        "root_path": f"workspace/courses/{course_id}",
        "is_default": 1,
        "is_archived": 0,
        "context_enabled": 0,
        "context_path": None,
        "context_updated_at": None,
        "created_at": timestamp,
        "updated_at": timestamp,
    }


def _row_to_dict(row: Any) -> dict[str, Any] | None:
    return dict(row._mapping) if row is not None else None


class SQLiteRepository:
    def __init__(self, engine: Engine):
        self.engine = engine

    @classmethod
    def from_path(cls, path: str | os.PathLike[str] | None = None) -> "SQLiteRepository":
        engine = create_sqlite_engine(path)
        initialize_database(engine)
        return cls(engine)

    def _insert(self, table: Table, values: dict[str, Any]) -> dict[str, Any]:
        with self.engine.begin() as connection:
            connection.execute(table.insert().values(**values))
            row = connection.execute(select(table).where(table.c.id == values["id"])).one()
            return dict(row._mapping)

    def _get_by_id(self, table: Table, row_id: str) -> dict[str, Any] | None:
        with self.engine.connect() as connection:
            row = connection.execute(select(table).where(table.c.id == row_id)).first()
            return _row_to_dict(row)

    def create_user(
        self,
        *,
        email: str,
        role: str,
        password_hash: str,
        id: str | None = None,
        created_at: str | None = None,
    ) -> dict[str, Any]:
        user_id = id or _new_id()
        timestamp = created_at or _now()
        with self.engine.begin() as connection:
            connection.execute(
                users.insert().values(
                    id=user_id,
                    email=email,
                    role=role,
                    password_hash=password_hash,
                    created_at=timestamp,
                )
            )
            connection.execute(
                projects.insert().values(**_default_project_values(user_id, now=timestamp))
            )
            row = connection.execute(select(users).where(users.c.id == user_id)).one()
            return dict(row._mapping)

    def get_user(self, user_id: str) -> dict[str, Any] | None:
        return self._get_by_id(users, user_id)

    def get_user_by_email(self, email: str) -> dict[str, Any] | None:
        with self.engine.connect() as connection:
            row = connection.execute(select(users).where(users.c.email == email)).first()
            return _row_to_dict(row)

    def create_session(
        self,
        *,
        user_id: str,
        token_hash: str,
        id: str | None = None,
        expires_at: str | None = None,
        created_at: str | None = None,
    ) -> dict[str, Any]:
        return self._insert(
            sessions,
            {
                "id": id or _new_id(),
                "user_id": user_id,
                "token_hash": token_hash,
                "expires_at": expires_at,
                "created_at": created_at or _now(),
            },
        )

    def get_session(self, session_id: str) -> dict[str, Any] | None:
        return self._get_by_id(sessions, session_id)

    def get_session_by_token_hash(self, token_hash: str) -> dict[str, Any] | None:
        with self.engine.connect() as connection:
            row = connection.execute(
                select(sessions).where(sessions.c.token_hash == token_hash)
            ).first()
            return _row_to_dict(row)

    def create_model_profile(
        self,
        *,
        display_name: str,
        provider: str,
        base_url: str,
        model: str,
        user_id: str | None = None,
        api_key_ref: str | None = None,
        context_window_hint: int | None = None,
        supports_streaming: bool = True,
        is_default: bool = False,
        id: str | None = None,
        created_at: str | None = None,
        updated_at: str | None = None,
    ) -> dict[str, Any]:
        now = _now()
        return self._insert(
            model_profiles,
            {
                "id": id or _new_id(),
                "user_id": user_id,
                "display_name": display_name,
                "provider": provider,
                "base_url": base_url,
                "model": model,
                "api_key_ref": api_key_ref,
                "context_window_hint": context_window_hint,
                "supports_streaming": int(supports_streaming),
                "is_default": int(is_default),
                "created_at": created_at or now,
                "updated_at": updated_at or now,
            },
        )

    def get_model_profile(self, profile_id: str) -> dict[str, Any] | None:
        return self._get_by_id(model_profiles, profile_id)

    def get_default_model_profile(self, user_id: str | None = None) -> dict[str, Any] | None:
        user_filter = (
            model_profiles.c.user_id.is_(None)
            if user_id is None
            else model_profiles.c.user_id == user_id
        )
        with self.engine.connect() as connection:
            row = connection.execute(
                select(model_profiles).where(
                    user_filter,
                    model_profiles.c.is_default == 1,
                )
            ).first()
            return _row_to_dict(row)

    def list_model_profiles(self, user_id: str | None = None) -> list[dict[str, Any]]:
        user_filter = (
            model_profiles.c.user_id.is_(None)
            if user_id is None
            else model_profiles.c.user_id == user_id
        )
        with self.engine.connect() as connection:
            rows = connection.execute(select(model_profiles).where(user_filter)).all()
            return [dict(row._mapping) for row in rows]

    def upsert_default_model_profile(
        self,
        *,
        user_id: str | None,
        display_name: str,
        provider: str,
        base_url: str,
        model: str,
        api_key_ref: str | None = None,
        context_window_hint: int | None = None,
        supports_streaming: bool = True,
    ) -> dict[str, Any]:
        now = _now()
        user_filter = (
            model_profiles.c.user_id.is_(None)
            if user_id is None
            else model_profiles.c.user_id == user_id
        )

        with self.engine.begin() as connection:
            existing = connection.execute(
                select(model_profiles).where(user_filter, model_profiles.c.is_default == 1)
            ).first()
            connection.execute(
                update(model_profiles).where(user_filter).values(is_default=0, updated_at=now)
            )

            values = {
                "user_id": user_id,
                "display_name": display_name,
                "provider": provider,
                "base_url": base_url,
                "model": model,
                "api_key_ref": api_key_ref,
                "context_window_hint": context_window_hint,
                "supports_streaming": int(supports_streaming),
                "is_default": 1,
                "updated_at": now,
            }
            if existing:
                profile_id = existing._mapping["id"]
                connection.execute(
                    update(model_profiles).where(model_profiles.c.id == profile_id).values(**values)
                )
            else:
                profile_id = _new_id()
                connection.execute(
                    model_profiles.insert().values(
                        id=profile_id,
                        created_at=now,
                        **values,
                    )
                )

            row = connection.execute(
                select(model_profiles).where(model_profiles.c.id == profile_id)
            ).one()
            return dict(row._mapping)

    def create_project(
        self,
        *,
        user_id: str,
        title: str,
        root_path: str,
        is_default: bool = False,
        is_archived: bool = False,
        context_enabled: bool = True,
        context_path: str | None = None,
        context_updated_at: str | None = None,
        id: str | None = None,
        created_at: str | None = None,
        updated_at: str | None = None,
    ) -> dict[str, Any]:
        now = _now()
        return self._insert(
            projects,
            {
                "id": id or _new_id(),
                "user_id": user_id,
                "title": title,
                "root_path": root_path,
                "is_default": int(is_default),
                "is_archived": int(is_archived),
                "context_enabled": int(context_enabled),
                "context_path": context_path,
                "context_updated_at": context_updated_at,
                "created_at": created_at or now,
                "updated_at": updated_at or now,
            },
        )

    def get_project(self, project_id: str) -> dict[str, Any] | None:
        return self._get_by_id(projects, project_id)

    def get_project_for_user(self, project_id: str, user_id: str) -> dict[str, Any] | None:
        with self.engine.connect() as connection:
            row = connection.execute(
                select(projects).where(
                    projects.c.id == project_id,
                    projects.c.user_id == user_id,
                )
            ).first()
            return _row_to_dict(row)

    def get_default_project(self, user_id: str) -> dict[str, Any] | None:
        with self.engine.connect() as connection:
            row = connection.execute(
                select(projects).where(
                    projects.c.user_id == user_id,
                    projects.c.is_default == 1,
                )
            ).first()
            return _row_to_dict(row)

    def get_or_create_default_project(self, user_id: str) -> dict[str, Any]:
        with self.engine.begin() as connection:
            row = connection.execute(
                select(projects).where(
                    projects.c.user_id == user_id,
                    projects.c.is_default == 1,
                )
            ).first()
            if row:
                return dict(row._mapping)
            values = _default_project_values(user_id)
            connection.execute(projects.insert().values(**values))
            return values

    def list_projects_for_user(
        self,
        user_id: str,
        *,
        include_archived: bool = False,
    ) -> list[dict[str, Any]]:
        query = select(projects).where(projects.c.user_id == user_id)
        if not include_archived:
            query = query.where(projects.c.is_archived == 0)
        query = query.order_by(projects.c.is_default.desc(), projects.c.created_at, projects.c.id)
        with self.engine.connect() as connection:
            rows = connection.execute(query).all()
            return [dict(row._mapping) for row in rows]

    def update_project(self, project_id: str, **values: Any) -> dict[str, Any] | None:
        if not values:
            return self.get_project(project_id)
        values["updated_at"] = _now()
        with self.engine.begin() as connection:
            connection.execute(
                update(projects).where(projects.c.id == project_id).values(**values)
            )
            row = connection.execute(
                select(projects).where(projects.c.id == project_id)
            ).first()
            return _row_to_dict(row)

    def create_run(
        self,
        *,
        user_id: str,
        intent: str,
        task_text: str,
        search_mode: str,
        status: str,
        project_id: str | None = None,
        model_profile_id: str | None = None,
        revision_of_run_id: str | None = None,
        output_root: str | None = None,
        error_message: str | None = None,
        id: str | None = None,
        created_at: str | None = None,
        updated_at: str | None = None,
    ) -> dict[str, Any]:
        now = _now()
        return self._insert(
            runs,
            {
                "id": id or _new_id(),
                "project_id": project_id,
                "user_id": user_id,
                "intent": intent,
                "task_text": task_text,
                "search_mode": search_mode,
                "status": status,
                "model_profile_id": model_profile_id,
                "revision_of_run_id": revision_of_run_id,
                "output_root": output_root,
                "error_message": error_message,
                "created_at": created_at or now,
                "updated_at": updated_at or now,
            },
        )

    def get_run(self, run_id: str) -> dict[str, Any] | None:
        return self._get_by_id(runs, run_id)

    def update_run(self, run_id: str, **values: Any) -> dict[str, Any] | None:
        if not values:
            return self.get_run(run_id)
        values["updated_at"] = _now()
        with self.engine.begin() as connection:
            connection.execute(update(runs).where(runs.c.id == run_id).values(**values))
            row = connection.execute(select(runs).where(runs.c.id == run_id)).first()
            return _row_to_dict(row)

    def create_upload(
        self,
        *,
        original_name: str,
        stored_path: str,
        sha256: str,
        size_bytes: int,
        user_id: str | None = None,
        run_id: str | None = None,
        media_type: str | None = None,
        id: str | None = None,
        created_at: str | None = None,
    ) -> dict[str, Any]:
        return self._insert(
            uploads,
            {
                "id": id or _new_id(),
                "user_id": user_id,
                "run_id": run_id,
                "original_name": original_name,
                "media_type": media_type,
                "stored_path": stored_path,
                "sha256": sha256,
                "size_bytes": size_bytes,
                "created_at": created_at or _now(),
            },
        )

    def get_upload(self, upload_id: str) -> dict[str, Any] | None:
        return self._get_by_id(uploads, upload_id)

    def get_upload_for_user(self, upload_id: str, user_id: str) -> dict[str, Any] | None:
        with self.engine.connect() as connection:
            row = connection.execute(
                select(uploads).where(
                    uploads.c.id == upload_id,
                    uploads.c.user_id == user_id,
                )
            ).first()
            return _row_to_dict(row)

    def create_artifact(
        self,
        *,
        run_id: str,
        kind: str,
        path: str,
        media_type: str | None = None,
        id: str | None = None,
        created_at: str | None = None,
    ) -> dict[str, Any]:
        return self._insert(
            artifacts,
            {
                "id": id or _new_id(),
                "run_id": run_id,
                "kind": kind,
                "path": path,
                "media_type": media_type,
                "created_at": created_at or _now(),
            },
        )

    def get_artifact(self, artifact_id: str) -> dict[str, Any] | None:
        return self._get_by_id(artifacts, artifact_id)

    def list_artifacts_for_run(self, run_id: str) -> list[dict[str, Any]]:
        with self.engine.connect() as connection:
            rows = connection.execute(select(artifacts).where(artifacts.c.run_id == run_id)).all()
            return [dict(row._mapping) for row in rows]

    def create_citation(
        self,
        *,
        run_id: str,
        title: str | None = None,
        url: str | None = None,
        snippet: str | None = None,
        id: str | None = None,
        created_at: str | None = None,
    ) -> dict[str, Any]:
        return self._insert(
            citations,
            {
                "id": id or _new_id(),
                "run_id": run_id,
                "title": title,
                "url": url,
                "snippet": snippet,
                "created_at": created_at or _now(),
            },
        )

    def get_citation(self, citation_id: str) -> dict[str, Any] | None:
        return self._get_by_id(citations, citation_id)

    def list_citations_for_run(self, run_id: str) -> list[dict[str, Any]]:
        with self.engine.connect() as connection:
            rows = connection.execute(select(citations).where(citations.c.run_id == run_id)).all()
            return [dict(row._mapping) for row in rows]
