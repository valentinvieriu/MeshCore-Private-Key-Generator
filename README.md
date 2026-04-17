# MeshCore Private Key Generator

A browser-based tool for generating **MeshCore-compatible private keys** whose derived public keys begin with a chosen hex prefix.

**[Live demo](https://valentinvieriu.github.io/MeshCore-Private-Key-Generator/)**

## Why this tool exists

MeshCore does **not** use standard PKCS#8 or JWK private keys for import/export. Instead, it expects a **64-byte raw private-key blob** represented as **128 hex characters**. Standard Ed25519 browser APIs can generate valid keypairs, but their exported private-key formats are not directly importable into MeshCore.

This tool bridges the gap by generating Ed25519 keys in the browser, extracting the 32-byte seed, converting it into the **MeshCore private-key format**, and searching for keys whose **raw public key** starts with a desired prefix.

## Features

- Runs entirely **client-side** — no server, no key upload
- Uses **libsodium WebAssembly in workers** for fast search, with native WebCrypto for PKCS#8 export and validation
- Generates the **64-byte / 128 hex char** MeshCore private-key format
- **Parallel search** with prewarmed reusable workers across available CPU cores
- Supports **1, 2, or 4 byte** vanity prefixes
- Blocks reserved prefixes (`00`, `FF`)
- **Validates** every result: key lengths, clamp bits, sign/verify round-trip

## MeshCore key format

1. Generate a **32-byte random Ed25519 seed**
2. Use the seed to derive an Ed25519 public key during the vanity search
3. Compute **SHA-512(seed)** → 64 bytes
4. Apply Ed25519 clamp to first 32 bytes:
   - `byte[0] &= 248`
   - `byte[31] &= 63`
   - `byte[31] |= 64`
5. Final key: `[32 clamped bytes][32 remaining SHA-512 bytes]` = **128 hex characters**

## Expected search cost

| Prefix | Average attempts |
|--------|-----------------|
| 1 byte | ~256 |
| 2 bytes | ~65,536 |
| 4 bytes | ~4,294,967,296 |

1-byte searches are quick. 2-byte searches are practical. 4-byte searches may take a long time.

## Getting started

```bash
npm install
npm run dev
```

## Tech stack

- [React 19](https://react.dev)
- [Vite 8](https://vite.dev)
- [Tailwind CSS 4](https://tailwindcss.com)

## Security

- Key generation stays local in the browser
- No backend required, deployable as a static page
- Verify generated key format before importing into production devices
- Keep generated private keys secret
- Prefer offline or isolated environments for sensitive use

## License

MIT
