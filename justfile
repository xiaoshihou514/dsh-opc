default:
  @just --list

# Install Node dependencies for both the plugin and desktop pet.
install-dev:
  pnpm install
  pnpm --dir desktop install

install: install-dev
  dsh plugin --profile web add "{{justfile_directory()}}"

# Generate ignored placeholder WebM clips for local UI work.
dummy-assets:
  pnpm assets:dummy

# Typecheck and test the Harness plugin.
check:
  pnpm check
  pnpm test

# Build the installable Harness plugin bundle.
build:
  pnpm build

# Rebuild the plugin bundle whenever source files change.
plugin-dev:
  pnpm exec tsdown --watch

# Start the Tauri pet against the local Harness web server.
pet-dev dsh_url='http://127.0.0.1:3080':
  pnpm --dir desktop dev -- --dsh-url {{dsh_url}}

# Validate the pet's browser and native components.
pet-check:
  pnpm --dir desktop check
  cargo check --manifest-path desktop/src-tauri/Cargo.toml

# Produce the WebM archive that a tagged CI release uploads; does not publish it.
pack-assets:
  pnpm assets:pack

format:
    prettier -w **/*.md **/*.js **/*.ts **/*.tsx **/*.css **/*.yaml **/*.json

# Full local verification without creating a GitHub release.
verify: check build pet-check
