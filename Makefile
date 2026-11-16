# open-waifu (macOS and Windows)
#
#   make dev        install, build core, try the engine, launch the app
#   make build      production build
#   make test       lint, vitest and the Rust tests
#   make clean      delete build output and caches
#
# Engine backends: JAN_ENGINE_VARIANT=cpu|vulkan|metal|cuda12|cuda13|hip, joined
# by `-` (default metal on macOS, vulkan elsewhere). CUDA/HIP builds also get vulkan as a runtime fallback
# unless JAN_ENGINE_VULKAN_FALLBACK=0. JAN_ENGINE_JOBS limits engine parallelism.

ifeq ($(OS),Windows_NT)
    DETECTED_OS := Windows
    # cmd.exe and sh spell mkdir and env prefixes differently; Git Bash puts sh on PATH.
    RECIPE_SHELL_IS_CMD := $(if $(filter sh sh.exe bash bash.exe,$(notdir $(SHELL))),,yes)
else
    DETECTED_OS := $(shell uname -s)
endif

ifeq ($(RECIPE_SHELL_IS_CMD),yes)
    MKDIR = if not exist "$(1)" mkdir "$(1)"
else
    MKDIR = mkdir -p $(1)
endif

.PHONY: all install dev dev-web build test test-rust lint \
        stub-resources build-engine build-engine-dev \
        engine-source check-engine-toolchain build-engine-dev-if-possible clean

all:
	@echo "Targets: dev dev-web build test lint build-engine clean"

install:
	yarn install
	yarn build:tauri:plugin:api
	yarn build:core

dev: install
	yarn download:bin
	$(MAKE) build-engine-dev-if-possible
	yarn dev

# UI only, in a browser.
dev-web:
	yarn install
	yarn build:core
	yarn dev:web

build: install
ifeq ($(DETECTED_OS),Darwin)
	rustup target add x86_64-apple-darwin aarch64-apple-darwin
endif
	$(MAKE) build-engine
	yarn build

lint: install
	yarn lint

test: lint
	yarn test
	yarn download:bin
	yarn copy:assets:tauri
	yarn build:icon
	$(MAKE) test-rust

# The app's build script requires every bundle.resources path to exist, so the
# engine and runtime binaries no test builds are stubbed first.
stub-resources:
	@node src-tauri/build-utils/stub-tauri-resources.mjs

test-rust: stub-resources
	cargo test --locked --manifest-path src-tauri/Cargo.toml --no-default-features --features test-tauri -- --test-threads=1
	cargo test --manifest-path src-tauri/plugins/tauri-plugin-hardware/Cargo.toml
	cargo test --manifest-path src-tauri/plugins/tauri-plugin-llamacpp/Cargo.toml
	cargo test --manifest-path src-tauri/utils/Cargo.toml
	# Plugin and utils lockfiles are gitignored, so only the main crate is --locked.

# ---------------------------------------------------------------------------
# llama.cpp engine worker

COMMA := ,
SPACE := $(subst ,, )
# macOS has no Vulkan SDK by default, and the app bundle requires the worker.
ifeq ($(DETECTED_OS),Darwin)
JAN_ENGINE_VARIANT ?= metal
else
JAN_ENGINE_VARIANT ?= vulkan
endif
JAN_ENGINE_VULKAN_FALLBACK ?= 1
JAN_ENGINE_CUDA_ARCHS ?=
JAN_ENGINE_HIP_TARGETS ?=
export JAN_ENGINE_CUDA_ARCHS JAN_ENGINE_HIP_TARGETS

ENGINE_TOKENS := $(subst -, ,$(JAN_ENGINE_VARIANT))
ENGINE_FEATURE_cpu := engine
ENGINE_FEATURE_vulkan := engine-vulkan
ENGINE_FEATURE_metal := engine-metal
ENGINE_FEATURE_cuda12 := engine-cuda
ENGINE_FEATURE_cuda13 := engine-cuda
ENGINE_FEATURE_hip := engine-hip
ENGINE_FEATURE_rocm := engine-hip

ENGINE_UNKNOWN_TOKENS := $(strip $(foreach t,$(ENGINE_TOKENS),$(if $(ENGINE_FEATURE_$(t)),,$(t))))
ifneq ($(ENGINE_UNKNOWN_TOKENS),)
    $(error Unknown JAN_ENGINE_VARIANT '$(JAN_ENGINE_VARIANT)': no backend named '$(ENGINE_UNKNOWN_TOKENS)')
endif
ifneq ($(word 2,$(filter cuda12 cuda13,$(ENGINE_TOKENS))),)
    $(error JAN_ENGINE_VARIANT '$(JAN_ENGINE_VARIANT)' names more than one CUDA major)
endif

ENGINE_VENDOR_FEATURES := $(filter engine-cuda engine-hip,$(foreach t,$(ENGINE_TOKENS),$(ENGINE_FEATURE_$(t))))
ENGINE_FEATURE_LIST := $(sort $(foreach t,$(ENGINE_TOKENS),$(ENGINE_FEATURE_$(t))) \
    $(if $(ENGINE_VENDOR_FEATURES),$(if $(filter 1,$(JAN_ENGINE_VULKAN_FALLBACK)),engine-vulkan,),))
ENGINE_FEATURES := $(subst $(SPACE),$(COMMA),$(ENGINE_FEATURE_LIST))

ENGINE_PLUGIN_DIR := src-tauri/plugins/tauri-plugin-llamacpp
ENGINE_SRC_DIR := $(ENGINE_PLUGIN_DIR)/vendor/llama.cpp
ENGINE_BIN_DIR := src-tauri/resources/bin
export JAN_ENGINE_BUILD_LOG := $(CURDIR)/src-tauri/target/engine-build.log

# make's -j does not reach cmake (build.rs reads cargo's NUM_JOBS), so translate it.
# Deferred `=`: MAKEFLAGS only carries -j once a recipe runs.
MAKE_J = $(strip $(patsubst -j%,%,$(filter -j%,$(MAKEFLAGS))))
JAN_ENGINE_JOBS ?= $(MAKE_J)
ENGINE_JOBS = $(if $(JAN_ENGINE_JOBS),$(if $(RECIPE_SHELL_IS_CMD),set CARGO_BUILD_JOBS=$(JAN_ENGINE_JOBS)&&,CARGO_BUILD_JOBS=$(JAN_ENGINE_JOBS)),)
# Cargo would otherwise try to join a jobserver it cannot inherit and warn every build.
export CARGO_MAKEFLAGS :=

# Cargo hides build-script output until failure, so tail cmake's log live (Unix only).
define with_engine_log
	@mkdir -p $(dir $(JAN_ENGINE_BUILD_LOG))
	@: > $(JAN_ENGINE_BUILD_LOG)
	@tail -F -n +1 $(JAN_ENGINE_BUILD_LOG) 2>/dev/null | sed 's/^/[engine] /' & \
	tail_pid=$$!; \
	trap 'kill $$tail_pid 2>/dev/null || true' EXIT INT TERM; \
	$(1); \
	rc=$$?; \
	sleep 1; \
	kill $$tail_pid 2>/dev/null || true; \
	exit $$rc
endef

ifeq ($(DETECTED_OS),Windows)
    ENGINE_CARGO = cd $(ENGINE_PLUGIN_DIR) && $(ENGINE_JOBS) cargo build $(1) --features $(ENGINE_FEATURES) --bin jan-llama-worker
else
    ENGINE_CARGO = $(call with_engine_log,cd $(ENGINE_PLUGIN_DIR) && $(ENGINE_JOBS) cargo build $(1) --features $(ENGINE_FEATURES) --bin jan-llama-worker)
endif

engine-source:
	bash src-tauri/build-utils/fetch-engine-source.sh

check-engine-toolchain:
	bash src-tauri/build-utils/check-engine-toolchain.sh $(JAN_ENGINE_VARIANT) $(ENGINE_FEATURES)

build-engine: engine-source check-engine-toolchain
	$(call MKDIR,$(ENGINE_BIN_DIR))
	$(call ENGINE_CARGO,--release)
	bash src-tauri/build-utils/stage-engine.sh release

build-engine-dev: engine-source check-engine-toolchain
	$(call MKDIR,$(ENGINE_BIN_DIR))
	$(call ENGINE_CARGO,)
	bash src-tauri/build-utils/stage-engine.sh debug

# `make dev` must not need a GPU toolchain, so the default variant is skipped when
# its toolchain is missing; a variant named explicitly fails instead.
build-engine-dev-if-possible:
ifeq ($(DETECTED_OS),Windows)
	-$(MAKE) build-engine-dev
else
	@if out=$$($(MAKE) --no-print-directory check-engine-toolchain 2>&1); then \
		$(MAKE) --no-print-directory build-engine-dev; \
	elif [ "$(origin JAN_ENGINE_VARIANT)" != "file" ]; then \
		echo "$$out" >&2; exit 1; \
	else \
		echo "Skipping the llama.cpp engine, toolchain incomplete:"; \
		echo "$$out" | sed 's/^/  /'; \
		echo "Local models will not run. Try: make build-engine-dev JAN_ENGINE_VARIANT=cpu"; \
	fi
endif

clean:
ifeq ($(DETECTED_OS),Windows)
	-powershell -Command "Get-ChildItem -Path . -Include node_modules, dist, build, out, .turbo -Recurse -Directory | Remove-Item -Recurse -Force"
	-powershell -Command "Get-ChildItem -Path . -Include tsconfig.tsbuildinfo -Recurse -File | Remove-Item -Force"
	-powershell -Command "Remove-Item -Recurse -Force ./core/*.tgz, ./src-tauri/resources, ./src-tauri/target, '$(ENGINE_SRC_DIR)' -ErrorAction SilentlyContinue"
else
	rm -rf $(ENGINE_SRC_DIR) ./src-tauri/resources ./src-tauri/target ./core/*.tgz
	find . -name node_modules -type d -prune -exec rm -rf '{}' +
	find . \( -name dist -o -name build -o -name out -o -name .turbo \) -type d -prune -exec rm -rf '{}' +
	find . -name tsconfig.tsbuildinfo -type f -delete
endif
