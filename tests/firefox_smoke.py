"""Install only in a fresh, temporary headless Firefox profile and test real downloads."""
import functools
import http.server
import json
import os
from pathlib import Path
import tempfile
import threading
import time
import uuid
from urllib.parse import urlsplit

from pypdf import PdfReader
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.firefox.options import Options
from selenium.webdriver.firefox.service import Service
from selenium.webdriver.support.ui import WebDriverWait

ROOT = Path(__file__).resolve().parents[1]
FIXTURES = ROOT / "tests" / "fixtures"
VERSION = json.loads((ROOT / "save-image-as" / "manifest.json").read_text())["version"]
PACKAGE = ROOT / "artifacts" / f"save-image-as-{VERSION}-unsigned.zip"


class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def do_GET(self):
        path = urlsplit(self.path).path
        if path == "/page":
            body = b'''<!doctype html><base href="/nested/"><title>Local extension fixture</title>
              <img id="responsive" src="../image.jpg" srcset="../responsive.jpg 1x">
              <img id="relative" src="../relative.jpg">'''
            self.send_response(200)
            self.send_header("Content-Type", "text/html")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        elif path == "/relative.jpg":
            self.path = "/responsive.jpg"
            super().do_GET()
        else:
            super().do_GET()


def wait_file(folder, name):
    file = folder / name
    deadline = time.monotonic() + 30
    while time.monotonic() < deadline:
        if file.exists() and file.stat().st_size > 0 and not (folder / (name + ".part")).exists():
            return file
        time.sleep(0.1)
    raise AssertionError(f"Download missing: {name}; present: {[p.name for p in folder.iterdir()]}")


def background(driver, source, *values):
    result = driver.execute_async_script('''
        const done = arguments[arguments.length - 1];
        const values = Array.from(arguments).slice(0, -1);
        (async () => {
          const bg = await browser.runtime.getBackgroundPage();
        ''' + source + '''
        })().then(value => done({ok: true, value}), error => done({ok: false, error: String(error)}));
    ''', *values)
    assert result["ok"], result
    return result.get("value")


def main():
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Handler, directory=str(FIXTURES)))
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base = f"http://127.0.0.1:{server.server_port}"
    try:
        with tempfile.TemporaryDirectory(prefix="save-image-as-firefox-") as scratch:
            downloads = Path(scratch) / "downloads"
            downloads.mkdir()
            options = Options()
            options.add_argument("-headless")
            extension_uuid = str(uuid.uuid4())
            options.set_preference("extensions.webextensions.uuids", json.dumps({"save-image-as@codebuff": extension_uuid}))
            if os.environ.get("FIREFOX_BINARY"):
                options.binary_location = os.environ["FIREFOX_BINARY"]
            options.set_preference("browser.download.folderList", 2)
            options.set_preference("browser.download.dir", str(downloads))
            options.set_preference("browser.download.useDownloadDir", True)
            options.set_preference("browser.download.alwaysOpenPanel", False)
            options.set_preference("browser.helperApps.neverAsk.saveToDisk", "image/jpeg,image/png,image/webp,application/pdf")
            # Required by current Firefox to inspect this test extension's own page.
            # The driver is loopback-only and Firefox creates a disposable profile.
            with webdriver.Firefox(options=options, service=Service(service_args=["--allow-system-access"])) as driver:
                driver.set_script_timeout(30)
                driver.install_addon(str(PACKAGE), temporary=True)
                extension = "moz-extension://" + extension_uuid
                driver.get(extension + "/options.html")
                for format_key in ("png", "jpg", "webp", "pdf"):
                    background(driver, 'return bg.handleMenuClick({menuItemId: "img_" + values[0], srcUrl: values[1]});', format_key, base + "/image.jpg")
                    file = wait_file(downloads, "image." + format_key)
                    data = file.read_bytes()
                    if format_key == "png":
                        assert data.startswith(b"\x89PNG\r\n\x1a\n")
                    elif format_key == "jpg":
                        assert data.startswith(b"\xff\xd8")
                    elif format_key == "webp":
                        assert data[:4] == b"RIFF" and data[8:12] == b"WEBP"
                    else:
                        reader = PdfReader(str(file), strict=True)
                        assert len(reader.pages) == 1
                        assert list(reader.pages[0].mediabox) == [0, 0, 4, 3]
                        image = reader.pages[0]["/Resources"]["/XObject"]["/Img1"].get_object()
                        assert image["/Filter"] == "/DCTDecode" and image.get_data().startswith(b"\xff\xd8")
                    print("PASS Firefox real conversion and download:", format_key, flush=True)
                before = set(downloads.iterdir())
                background(driver, 'return bg.handleMenuClick({menuItemId: "img_pdf", srcUrl: values[0]});', base + "/missing.png")
                assert set(downloads.iterdir()) == before
                WebDriverWait(driver, 10).until(lambda d: d.find_element(By.ID, "downloadError").is_displayed())
                assert "HTTP 404" in driver.find_element(By.ID, "downloadError").text
                print("PASS Firefox conversion failure is visible and produces no fake PDF", flush=True)
                driver.execute_async_script('const done = arguments[0]; browser.storage.local.set({enableFloating: true}).then(done);')
                driver.get(base + "/page")
                wait = WebDriverWait(driver, 15)
                wait.until(lambda d: d.find_element(By.ID, "responsive").get_property("naturalWidth") > 50)
                wait.until(lambda d: d.find_element(By.CSS_SELECTOR, ".sia-float-toggle")).click()
                driver.find_element(By.ID, "responsive").click()
                assert wait_file(downloads, "responsive.jpg").read_bytes() == (FIXTURES / "responsive.jpg").read_bytes()
                driver.find_element(By.ID, "relative").click()
                assert wait_file(downloads, "relative.jpg").read_bytes() == (FIXTURES / "responsive.jpg").read_bytes()
                print("PASS Firefox floating downloads use currentSrc and resolved relative URLs", flush=True)
                print("Firefox", driver.capabilities["browserVersion"], "integration passed", flush=True)
    finally:
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    main()
