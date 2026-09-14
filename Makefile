.PHONY: contracts contracts-check

# Always clone the same source remote CI uses unless CONTRACTS_REPO is set.
# A local sibling override hides unpushed CONTRACTS_REV pins from scripts/ci.sh.
CONTRACTS_REPO ?= https://github.com/GuilhermeFortuna/q_contracts.git

# Ubuntu runners use dash as /bin/sh; pipefail and friends need bash.
SHELL := /bin/bash

contracts:
	set -euo pipefail; \
	contracts_tmp="$$(mktemp -d)"; \
	trap 'rm -rf "$$contracts_tmp"' EXIT; \
	git clone --quiet "$(CONTRACTS_REPO)" "$$contracts_tmp/q_contracts"; \
	git -C "$$contracts_tmp/q_contracts" checkout --quiet "$$(tr -d '[:space:]' < CONTRACTS_REV)"; \
	rm -rf contracts; \
	mkdir -p contracts; \
	cp -R "$$contracts_tmp/q_contracts/generated/typescript/." contracts/

contracts-check:
	set -euo pipefail; \
	contracts_tmp="$$(mktemp -d)"; \
	trap 'rm -rf "$$contracts_tmp"' EXIT; \
	git clone --quiet "$(CONTRACTS_REPO)" "$$contracts_tmp/q_contracts"; \
	rev="$$(tr -d '[:space:]' < CONTRACTS_REV)"; \
	if ! git -C "$$contracts_tmp/q_contracts" checkout --quiet "$$rev"; then \
		echo "error: cannot checkout CONTRACTS_REV=$$rev from $(CONTRACTS_REPO)" >&2; \
		echo "error: push that commit to the remote, or set CONTRACTS_REPO to a local clone that has it" >&2; \
		exit 1; \
	fi; \
	generated_tmp="$$contracts_tmp/generated"; \
	if python3 -c 'import yaml' 2>/dev/null; then \
		python3 "$$contracts_tmp/q_contracts/tools/generate.py" --language typescript --out "$$generated_tmp"; \
	else \
		uv run --project "$$contracts_tmp/q_contracts" python "$$contracts_tmp/q_contracts/tools/generate.py" \
			--language typescript --out "$$generated_tmp"; \
	fi; \
	diff -ru contracts "$$generated_tmp/typescript"
