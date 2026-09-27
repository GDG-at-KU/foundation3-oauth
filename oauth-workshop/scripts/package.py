"""Create clean starter and complete ZIPs; deliberately allowlist source files."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

root = Path(__file__).resolve().parent.parent
output = root.parent / "oauth-workshop-downloads"
output.mkdir(exist_ok=True)
top_files = [".env.example", ".gitignore", "README.md", "index.html",
             "package.json", "package-lock.json", "requirements.txt", "server.py",
             "vite.config.js", "playwright.config.js"]
sources = [root / name for name in top_files]
sources.extend(root / name for name in [
    "src/auth.js", "src/firebase.js", "src/main.js", "src/style.css",
    "src/tracker.js", "src/applications.js", "src/sample-data.js", "src/config.js", "src/summary.js",
    "checkpoints/03-start.js", "checkpoints/03-signin.js",
    "checkpoints/03-state.js", "checkpoints/03-complete.js",
    "scripts/checkpoint.mjs", "scripts/package.py",
    "tests/test_server.py", "tests/browser.spec.js",
])

for variant, checkpoint in (("starter", "03-start"), ("complete", "03-complete")):
    destination = output / f"oauth-workshop-{variant}.zip"
    with ZipFile(destination, "w", ZIP_DEFLATED) as archive:
        for source in sources:
            relative = source.relative_to(root).as_posix()
            content = (root / "checkpoints" / f"{checkpoint}.js").read_bytes() if relative == "src/auth.js" else source.read_bytes()
            archive.writestr(f"oauth-workshop/{relative}", content)
    with ZipFile(destination) as archive:
        assert archive.testzip() is None
        assert "oauth-workshop/.env.local" not in archive.namelist()
        assert archive.read("oauth-workshop/src/auth.js") == (root / "checkpoints" / f"{checkpoint}.js").read_bytes()
    print(f"{destination.name}: {destination.stat().st_size:,} bytes; contents verified")
