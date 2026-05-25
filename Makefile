# Top-level developer-experience targets. Production deploys do NOT use this
# file — they build from the API service directly (see render.yaml) or the
# ingest workflow (see .github/workflows/ingest.yml).

API_VENV := services/api/.venv
PY        := $(API_VENV)/bin/python
PIP       := $(API_VENV)/bin/pip
SITE_PKGS := $(API_VENV)/lib/python3.12/site-packages

.PHONY: help install-ingest-dev fix-venv-hidden ingest

help:
	@echo "Targets:"
	@echo "  install-ingest-dev  Editable-install packages/ingest into the API venv (macOS-safe)"
	@echo "  fix-venv-hidden     Clear macOS UF_HIDDEN on .venv (rerun after any pip install -e)"
	@echo "  ingest SOURCE=slug  Run the ingest CLI for one source from the API venv"

# Local dev editable install. Required to import longform_ingest from the API
# venv when developing both packages together. On macOS, setuptools' editable
# install sets UF_HIDDEN on the .pth file; Python's site.addpackage then skips
# the file ("Skipping hidden .pth file: …") and the import silently fails.
# We clear the flag immediately after install — production (Render + GHA)
# uses a normal non-editable `pip install ./packages/ingest` and is unaffected.
install-ingest-dev:
	$(PIP) install -e packages/ingest
	$(MAKE) fix-venv-hidden

fix-venv-hidden:
	@if [ "$$(uname)" = "Darwin" ]; then \
	  chflags -R nohidden $(SITE_PKGS) && \
	  echo "Cleared UF_HIDDEN under $(SITE_PKGS)"; \
	fi

# Convenience: `make ingest SOURCE=hakai`
ingest:
	@if [ -z "$(SOURCE)" ]; then echo "Usage: make ingest SOURCE=<slug>"; exit 1; fi
	$(PY) -m longform_ingest --source $(SOURCE)
