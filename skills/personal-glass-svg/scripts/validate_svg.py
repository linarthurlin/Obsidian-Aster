"""Validate local, self-contained SVG resources; visual layout still needs inspection."""
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path


def validate(path):
    content = Path(path).read_text(encoding="utf-8")
    if re.search(r"<!DOCTYPE|<!ENTITY", content, re.I):
        raise ValueError("Document types and entities are not allowed")
    root = ET.fromstring(content)
    if root.tag != "{http://www.w3.org/2000/svg}svg":
        raise ValueError("Expected SVG root namespace")
    viewbox = [float(n) for n in root.attrib.get("viewBox", "").replace(",", " ").split()]
    if len(viewbox) != 4 or not all(float("-inf") < n < float("inf") for n in viewbox) or min(viewbox[2:]) <= 0:
        raise ValueError("Expected a finite, positive viewBox")
    tags = [element.tag.rsplit("}", 1)[-1] for element in root.iter()]
    if "title" not in tags or "desc" not in tags:
        raise ValueError("Accessible title and description are required")
    ids = set()
    for element in root.iter():
        tag = element.tag.rsplit("}", 1)[-1]
        if tag.lower() in {"script", "foreignobject", "iframe", "audio", "video"}:
            raise ValueError("Active or embedded content is not allowed")
        identity = element.attrib.get("id")
        if identity:
            if identity in ids:
                raise ValueError("Duplicate SVG id")
            ids.add(identity)
        for key, value in element.attrib.items():
            name = key.rsplit("}", 1)[-1].lower()
            if name.startswith("on"):
                raise ValueError("Event handlers are not allowed")
            if name == "href" and not value.startswith("#"):
                raise ValueError("External resources are not allowed")
            for url in re.findall(r"url\((.*?)\)", value, re.I):
                if not url.strip(" '\"").startswith("#"):
                    raise ValueError("External CSS resources are not allowed")
        if tag.lower() == "style":
            style = element.text or ""
            if re.search(r"@import|https?:|file:|data:", style, re.I):
                raise ValueError("External styles are not allowed")
            for url in re.findall(r"url\((.*?)\)", style, re.I):
                if not url.strip(" '\"").startswith("#"):
                    raise ValueError("External styles are not allowed")
    print(f"Valid offline SVG: {Path(path).name}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        raise SystemExit("Usage: python validate_svg.py image.svg [image.svg ...]")
    for svg in sys.argv[1:]:
        validate(svg)
