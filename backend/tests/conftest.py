import asyncio
import os
from pathlib import Path

import httpx
import pytest

os.environ.setdefault("TESTING", "1")

from backend.main import app
from backend.pipelines.html_to_pdf import ConvertError, ConvertResult
from backend.providers.base import ModelProviderError
from backend.storage.sqlite import SQLiteRepository


class ASGISyncClient:
    def __init__(self, asgi_app, base_url: str = "http://testserver"):
        self.asgi_app = asgi_app
        self.base_url = base_url

    def __enter__(self):
        return self

    def __exit__(self, _exc_type, _exc, _tb):
        return None

    def get(self, url: str, **kwargs):
        return self.request("GET", url, **kwargs)

    def post(self, url: str, **kwargs):
        return self.request("POST", url, **kwargs)

    def put(self, url: str, **kwargs):
        return self.request("PUT", url, **kwargs)

    def patch(self, url: str, **kwargs):
        return self.request("PATCH", url, **kwargs)

    def request(self, method: str, url: str, **kwargs):
        return asyncio.run(self._request(method, url, **kwargs))

    async def _request(self, method: str, url: str, **kwargs):
        transport = httpx.ASGITransport(app=self.asgi_app)
        async with httpx.AsyncClient(
            transport=transport,
            base_url=self.base_url,
        ) as async_client:
            response = await async_client.request(method, url, **kwargs)
            await response.aread()
            return response


@pytest.fixture(scope="function")
def client():
    with ASGISyncClient(app) as c:
        yield c
    app.dependency_overrides.clear()


class FakeModelProvider:
    def __init__(self, output: str = "", error: ModelProviderError | None = None):
        self.output = output
        self.error = error
        self.requests = []

    def generate_text(self, request):
        self.requests.append(request)
        if self.error:
            raise self.error
        return self.output


class MockPdfConverter:
    def __init__(self, *, should_fail: bool = False):
        self.should_fail = should_fail
        self.calls = []

    def convert(self, *, html_path: Path, pdf_path: Path, page_config):
        self.calls.append(
            {"html_path": html_path, "pdf_path": pdf_path, "page_config": page_config}
        )
        if self.should_fail:
            raise ConvertError("Mock conversion failure", log_text="mock error log\n")
        assert html_path.exists()
        pdf_path.parent.mkdir(parents=True, exist_ok=True)
        pdf_path.write_bytes(b"%PDF-1.4 mock\n")
        return ConvertResult(pdf_path=pdf_path, log_text="mock convert OK\n")


class NoopSearchAdapter:
    def search(self, query: str, *, max_results: int = 3):
        raise AssertionError("search should not run in these tests")


@pytest.fixture()
def fake_model_provider_factory():
    return FakeModelProvider


@pytest.fixture()
def mock_pdf_converter():
    return MockPdfConverter()


@pytest.fixture()
def failing_pdf_converter():
    return MockPdfConverter(should_fail=True)


@pytest.fixture()
def noop_search_adapter():
    return NoopSearchAdapter()


@pytest.fixture()
def repo_with_user(tmp_path):
    repo = SQLiteRepository.from_path(tmp_path / "app.sqlite")
    user = repo.create_user(
        id="user-1",
        email="teacher@bnbu.edu.cn",
        role="teacher",
        password_hash="hash",
    )
    return repo, user
