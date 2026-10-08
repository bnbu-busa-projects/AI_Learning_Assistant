from backend.storage.sqlite import (
    SCHEMA_VERSION,
    SQLiteRepository,
    create_sqlite_engine,
    get_schema_version,
    initialize_database,
)

EXPECTED_TABLES = {
    "users",
    "sessions",
    "model_profiles",
    "model_secrets",
    "projects",
    "runs",
    "uploads",
    "artifacts",
    "citations",
}


def test_initialize_database_creates_contract_tables(tmp_path):
    db_path = tmp_path / "data" / "app.sqlite"
    engine = create_sqlite_engine(db_path)

    initialize_database(engine)

    assert db_path.exists()
    assert get_schema_version(engine) == SCHEMA_VERSION
    with engine.connect() as connection:
        table_names = set(
            connection.exec_driver_sql(
                "select name from sqlite_master where type = 'table'"
            ).scalars()
        )
        run_columns = {
            row._mapping["name"]
            for row in connection.exec_driver_sql("PRAGMA table_info(runs)").all()
        }
        upload_columns = {
            row._mapping["name"]
            for row in connection.exec_driver_sql("PRAGMA table_info(uploads)").all()
        }
        project_columns = {
            row._mapping["name"]
            for row in connection.exec_driver_sql("PRAGMA table_info(projects)").all()
        }
    assert EXPECTED_TABLES.issubset(table_names)
    assert "revision_of_run_id" in run_columns
    assert "user_id" in upload_columns
    assert {
        "is_default",
        "is_archived",
        "context_enabled",
        "context_path",
        "context_updated_at",
    }.issubset(project_columns)


def test_repository_inserts_and_reads_representative_metadata(tmp_path):
    repo = SQLiteRepository.from_path(tmp_path / "app.sqlite")

    user = repo.create_user(
        id="user-1",
        email="teacher@bnbu.edu.cn",
        role="teacher",
        password_hash="hash:local",
    )
    session = repo.create_session(
        id="session-1",
        user_id=user["id"],
        token_hash="sha256:token",
    )
    profile = repo.create_model_profile(
        id="profile-1",
        user_id=user["id"],
        display_name="Qwen local profile",
        provider="openai_compatible",
        base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
        model="qwen-placeholder",
        api_key_ref="env:MODEL_API_KEY",
        context_window_hint=128000,
        supports_streaming=True,
        is_default=True,
    )
    project = repo.create_project(
        id="project-1",
        user_id=user["id"],
        title="CS homework",
        root_path="workspace/project-1",
    )
    run = repo.create_run(
        id="run-1",
        project_id=project["id"],
        user_id=user["id"],
        model_profile_id=profile["id"],
        intent="code_homework",
        task_text="Solve the assignment.",
        search_mode="auto",
        status="queued",
        output_root="workspace/project-1/run-1",
    )
    revision_run = repo.create_run(
        id="run-2",
        project_id=project["id"],
        user_id=user["id"],
        model_profile_id=profile["id"],
        intent="code_homework",
        task_text="Refine the assignment.",
        search_mode="auto",
        status="queued",
        revision_of_run_id=run["id"],
        output_root="workspace/project-1/run-2",
    )
    upload = repo.create_upload(
        id="upload-1",
        user_id=user["id"],
        run_id=run["id"],
        original_name="brief.pdf",
        media_type="application/pdf",
        stored_path="workspace/uploads/brief.pdf",
        sha256="0" * 64,
        size_bytes=128,
    )
    artifact = repo.create_artifact(
        id="artifact-1",
        run_id=run["id"],
        kind="manifest",
        path="workspace/project-1/run-1/manifest.json",
        media_type="application/json",
    )
    citation = repo.create_citation(
        id="citation-1",
        run_id=run["id"],
        title="Reference",
        url="https://example.edu/reference",
        snippet="Short source note.",
    )

    assert repo.get_user(user["id"])["email"] == "teacher@bnbu.edu.cn"
    assert repo.get_user_by_email("teacher@bnbu.edu.cn")["id"] == user["id"]
    assert repo.get_session(session["id"])["token_hash"] == "sha256:token"
    assert repo.get_model_profile(profile["id"])["api_key_ref"] == "env:MODEL_API_KEY"
    assert repo.get_project(project["id"])["root_path"] == "workspace/project-1"
    default_project = repo.get_default_project(user["id"])
    assert default_project["title"] == "Just Asking"
    assert default_project["is_default"] == 1
    assert default_project["context_enabled"] == 0
    assert repo.get_run(run["id"])["status"] == "queued"
    assert repo.get_run(run["id"])["revision_of_run_id"] is None
    assert repo.get_run(revision_run["id"])["revision_of_run_id"] == run["id"]
    assert repo.get_upload(upload["id"])["stored_path"] == "workspace/uploads/brief.pdf"
    assert repo.get_upload_for_user(upload["id"], user["id"])["id"] == upload["id"]
    assert repo.get_upload_for_user(upload["id"], "other-user") is None
    assert repo.get_artifact(artifact["id"])["kind"] == "manifest"
    assert repo.get_citation(citation["id"])["url"] == "https://example.edu/reference"
    assert repo.list_citations_for_run(run["id"])[0]["id"] == citation["id"]


def test_initialize_database_migrates_v1_runs_with_revision_column(tmp_path):
    db_path = tmp_path / "legacy.sqlite"
    engine = create_sqlite_engine(db_path)
    with engine.begin() as connection:
        connection.exec_driver_sql(
            """
            create table runs (
                id text primary key,
                project_id text nullable,
                user_id text not null,
                intent text not null,
                task_text text not null,
                search_mode text not null,
                status text not null,
                model_profile_id text nullable,
                output_root text nullable,
                error_message text nullable,
                created_at text not null,
                updated_at text not null
            )
            """
        )
        connection.exec_driver_sql("PRAGMA user_version = 1")

    initialize_database(engine)

    assert get_schema_version(engine) == SCHEMA_VERSION
    with engine.connect() as connection:
        run_columns = {
            row._mapping["name"]
            for row in connection.exec_driver_sql("PRAGMA table_info(runs)").all()
        }
    assert "revision_of_run_id" in run_columns


def test_initialize_database_migrates_v2_uploads_with_user_id_column(tmp_path):
    db_path = tmp_path / "legacy-v2.sqlite"
    engine = create_sqlite_engine(db_path)
    with engine.begin() as connection:
        connection.exec_driver_sql(
            """
            create table uploads (
                id text primary key,
                run_id text nullable,
                original_name text not null,
                media_type text nullable,
                stored_path text not null,
                sha256 text not null,
                size_bytes integer not null,
                created_at text not null
            )
            """
        )
        connection.exec_driver_sql("PRAGMA user_version = 2")

    initialize_database(engine)

    assert get_schema_version(engine) == SCHEMA_VERSION
    with engine.connect() as connection:
        upload_columns = {
            row._mapping["name"]
            for row in connection.exec_driver_sql("PRAGMA table_info(uploads)").all()
        }
    assert "user_id" in upload_columns


def test_initialize_database_migrates_v3_projects_and_backfills_default_course(tmp_path):
    db_path = tmp_path / "legacy-v3.sqlite"
    engine = create_sqlite_engine(db_path)
    with engine.begin() as connection:
        connection.exec_driver_sql(
            """
            create table users (
                id text primary key,
                email text unique not null,
                role text not null,
                password_hash text not null,
                created_at text not null
            )
            """
        )
        connection.exec_driver_sql(
            """
            create table projects (
                id text primary key,
                user_id text not null,
                title text not null,
                root_path text not null,
                created_at text not null,
                updated_at text not null
            )
            """
        )
        connection.exec_driver_sql(
            """
            insert into users (id, email, role, password_hash, created_at)
            values ('user-legacy', 'legacy@bnbu.edu.cn', 'teacher', 'hash', '2026-06-01T00:00:00Z')
            """
        )
        connection.exec_driver_sql(
            """
            insert into projects (id, user_id, title, root_path, created_at, updated_at)
            values (
                'project-legacy',
                'user-legacy',
                'Legacy Project',
                'workspace/project-legacy',
                '2026-06-01T00:00:00Z',
                '2026-06-01T00:00:00Z'
            )
            """
        )
        connection.exec_driver_sql("PRAGMA user_version = 3")

    initialize_database(engine)
    repo = SQLiteRepository(engine)

    assert get_schema_version(engine) == SCHEMA_VERSION
    legacy = repo.get_project("project-legacy")
    assert legacy["is_default"] == 0
    assert legacy["is_archived"] == 0
    assert legacy["context_enabled"] == 1
    default_course = repo.get_default_project("user-legacy")
    assert default_course["title"] == "Just Asking"
    assert default_course["context_enabled"] == 0
    assert len([row for row in repo.list_projects_for_user("user-legacy") if row["is_default"]]) == 1


def test_v4_migration_preserves_users_and_profiles(tmp_path):
    repo = SQLiteRepository.from_path(tmp_path / "v4.sqlite")
    user = repo.create_user(email="migration@bnbu.edu.cn", role="teacher", password_hash="hash")
    profile = repo.create_model_profile(user_id=user["id"], display_name="Legacy", provider="openai_compatible", base_url="https://example.com", model="example", api_key_ref="env:MODEL_API_KEY")
    with repo.engine.begin() as connection:
        connection.exec_driver_sql("DROP TABLE model_secrets")
        connection.exec_driver_sql("PRAGMA user_version=4")
    initialize_database(repo.engine)
    assert get_schema_version(repo.engine) == 5
    assert repo.get_user_by_email(user["email"])["id"] == user["id"]
    assert repo.get_model_profile(profile["id"])["api_key_ref"] == "env:MODEL_API_KEY"
    assert not repo.has_model_secrets()
