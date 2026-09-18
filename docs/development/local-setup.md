# Local Setup

The program builds and tests without a validator, a frontend, or a network
connection beyond the toolchain download.

## Toolchains

All Rust and Solana toolchains come from `mise`, not from system installs. The
pins live in `trana/mise.toml`:

```toml
[tools]
"github:anza-xyz/agave" = { version = "latest", matching = "tar.bz2", bin_path = "solana-release/bin" }
"github:otter-sec/anchor" = "latest"
"github:solana-foundation/surfpool" = "latest"
"cargo:cargo-nextest" = "latest"
"cargo:cargo-edit" = "latest"
sccache = "latest"
bun = "latest"
```

```bash
mise install
```

Note that the Anchor binary is an `otter-sec/anchor` fork, not upstream Anchor.
Build output can differ from what the upstream release produces.

## Build

```bash
cd trana
anchor build
```

This produces `trana/target/deploy/trana.so`. The release profile sets
`overflow-checks = true`, `lto = "fat"`, and `codegen-units = 1`, so builds are
slow and the artifact is optimized.

::: danger Always build before testing
`tests/test_trana.rs` loads the program with `include_bytes!`:

```rust
let bytes = include_bytes!(concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../../target/deploy/trana.so"
));
```

The bytes are embedded **at compile time**. A stale `.so` means the test binary
silently exercises old program code — the tests pass, and they are testing the
wrong thing. Run `anchor build` before every test run, especially after editing
`src/`.
:::

## Test

```bash
cd trana
cargo nextest run
```

`Anchor.toml` makes this authoritative:

```toml
[scripts]
test = "cargo nextest run"
```

Not `cargo test`, and not `anchor test` — the suite is LiteSVM-based and needs no
validator, no `anchor-client`, and no local cluster. `skip_local_validator = true`
is set in `Anchor.toml` for the same reason.

Expected output is 15 passing tests in roughly a second.

## Type-check loop

```bash
cd trana/programs/trana
cargo check --all-targets
```

Much faster than a full build, and the right loop while editing. It does not
update the `.so`, so it cannot substitute for `anchor build` before testing.

## Formatting

```bash
cargo fmt
```

On the pinned stable toolchain this emits six "unstable features are only
available in nightly" warnings and ignores `.rustfmt.toml` entirely. The config's
import grouping and string formatting are inert. Do not reformat on the
assumption those options are live, and expect import ordering to differ from what
the config appears to request.

## Cluster configuration

`Anchor.toml` targets localnet only:

```toml
[programs.localnet]
trana = "En2EGbw2JuJkQbmgueXEN2XaiBjHvzf4bPwCrUyTqMNf"

[provider]
cluster = "localnet"
wallet = "~/.config/solana/id.json"
```

The program id is the deployed identity. `declare_id!` in `lib.rs` and the
`[programs.localnet]` entry must agree, and
`trana/target/deploy/trana-keypair.json` is the keypair that backs it. Changing
any of the three breaks the address that PDAs derive from.

For a local validator with rebuild-and-redeploy on change:

```bash
cd trana
surfpool start --watch
```

Or deploy through the txtx runbook:

```bash
cd trana
surfpool run deployment
```

`trana/txtx.yml` defines `localnet` (127.0.0.1:8899) and `devnet`. The devnet
deployment signer is an `svm::web_wallet`, not a keypair path, so devnet deploys
need an interactive wallet.

## Documentation site

```bash
cd docs
bun install
bun run dev
```

See [Docs Toolchain](/development/docs-toolchain) for the site's own tooling and
scripts.

## Common gotchas

| Symptom | Cause |
|---|---|
| Tests pass but behaviour is stale | `.so` not rebuilt — run `anchor build` |
| Account deserialisation garbage | `#[account]` field order changed |
| PDA not found | Seed literal or `u64` endianness mismatch |
| Bump mismatch | Deriving a PDA without the stored bump |
| `cargo fmt` warnings | Pinned stable channel; config is inert |
| Anchor version skew | `otter-sec/anchor` fork, not upstream |
