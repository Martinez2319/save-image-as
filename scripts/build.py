"""Build an unsigned Firefox development package with the manifest at ZIP root."""
import hashlib
import json
from pathlib import Path
import zipfile

root = Path(__file__).resolve().parents[1]
source = root / "save-image-as"
version = json.loads((source / "manifest.json").read_text(encoding="utf-8"))["version"]
output = root / "artifacts"
output.mkdir(exist_ok=True)
package = output / f"save-image-as-{version}-unsigned.zip"
with zipfile.ZipFile(package, "w", zipfile.ZIP_DEFLATED) as archive:
    for file in sorted(source.rglob("*")):
        if file.is_file():
            archive.write(file, file.relative_to(source).as_posix())
(output / "SHA256.txt").write_text(hashlib.sha256(package.read_bytes()).hexdigest() + "  " + package.name + "\n", encoding="utf-8")
print(package)
