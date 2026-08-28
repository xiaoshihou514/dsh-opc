default:
  @just --list

# Install Node dependencies for both the plugin and desktop pet.
install-dev:
  pnpm install
  pnpm --dir desktop install

install: install-dev build
  dsh plugin --profile web add "{{justfile_directory()}}"

# Generate ignored placeholder WebM clips for local UI work.
dummy-assets:
  pnpm assets:dummy

# Convert the raw green-screen animations into transparent WebM assets.
process-assets:
  pnpm assets:process

# Typecheck and test the Harness plugin.
check:
  pnpm check
  pnpm test

# Build the installable Harness plugin bundle.
build:
  pnpm build

# Start the Tauri pet against the local Harness web server.
pet-dev dsh_url='http://127.0.0.1:3080':
  pnpm --dir desktop dev -- --dsh-url {{dsh_url}}

# Validate the pet's browser and native components.
pet-check:
  pnpm --dir desktop check
  cargo check --manifest-path desktop/src-tauri/Cargo.toml

# Cross-compile the Windows NSIS installer from Linux/WSL (cargo-xwin).
# Requires the local llvm-local clang-19 toolchain (see llvm-local/extract).
pet-exe:
  cd desktop && PATH="/home/xiaoshihou/Playground/dsh/llvm-local/extract/usr/lib/llvm-19/bin:$$PATH" LD_LIBRARY_PATH="/home/xiaoshihou/Playground/dsh/llvm-local/extract/usr/lib/x86_64-linux-gnu:/home/xiaoshihou/Playground/dsh/llvm-local/extract/usr/lib/llvm-19/lib:$$LD_LIBRARY_PATH" RC=x86_64-w64-mingw32-windres pnpm exec tauri build --target x86_64-pc-windows-msvc --runner cargo-xwin --bundles nsis

# Produce the WebM archive that a tagged CI release uploads; does not publish it.
pack-assets:
  pnpm assets:pack

# Upload dsh-opc-assets.tar.gz to the given tag's GitHub release (creates it if missing).
upload-assets tag:
  @test -f dsh-opc-assets.tar.gz || { echo "dsh-opc-assets.tar.gz missing; run: just pack-assets"; exit 1; }
  gh release view "{{tag}}" >/dev/null 2>&1 \
    && gh release upload "{{tag}}" dsh-opc-assets.tar.gz --clobber \
    || gh release create "{{tag}}" dsh-opc-assets.tar.gz --title "{{tag}}" --generate-notes
  @echo "Uploaded dsh-opc-assets.tar.gz to release {{tag}}"

format:
    prettier -w **/*.md **/*.js **/*.ts **/*.tsx **/*.css **/*.yaml **/*.json
    cd desktop/src-tauri/ && cargo fmt

# Full local verification without creating a GitHub release.
verify: check build pet-check
