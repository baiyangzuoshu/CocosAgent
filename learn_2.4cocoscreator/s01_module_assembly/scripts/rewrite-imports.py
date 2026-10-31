from pathlib import Path
import re


module_path = re.compile(r'(["\'])(\.{1,2}/[^"\']+)\.ts\1')

for js_file in Path("dist/src").rglob("*.js"):
    source = js_file.read_text(encoding="utf-8")
    output = module_path.sub(r"\1\2.js\1", source)
    js_file.write_text(output, encoding="utf-8")
