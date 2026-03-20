---
title: "From Opaque Bytes to Universal Services: Introducing Sails Header v1"
date: 2025-12-06
description: "How a 16-byte header transforms opaque SCALE payloads into self-describing service calls — and why that lets wallets render UIs instantly and indexers query the whole network by type."
tags: ["vara", "sails", "gear protocol"]
giscus: true
toc: true
---

> **📢 Update (March 2026):** **Sails v1.0.0-beta.1**🛥 is now released! The Sails Header (v1) described in this post has shipped as part of this release, alongside IDL V2, new interface ID and ReflectHash specs. This article was written in December 2025 when the specification was still in development — it is now live. → [Release notes on GitHub](https://github.com/gear-tech/sails/releases/tag/rs%2Fv1.0.0-beta.1)

---

If you've ever tried to build an indexer or a block explorer on top of Vara, you know the problem: you see a message, you see a payload, and that's it. Without the program's metadata — the Wasm binary, the source, some side-channel ABI file — that payload is just bytes. You can't tell a `Token::Transfer` from a `Game::Attack`.

The usual answer is "build it per-dApp". Every frontend hardcodes its own decoding logic. Every indexer needs execution context. It works, but it doesn't scale, and it means the ecosystem stays fragmented by default.

Sails Header v1 is our answer to that. It's a 16-byte prefix on every message — no runtime changes, no consensus involvement, purely userspace — that turns opaque payloads into self-describing service calls.

## The Optimistic Identification Trick

Before getting into the wire format, it's worth explaining the most useful thing this enables, because it's not obvious from the spec alone.

The **Interface ID** — an 8-byte field in the header — is a structural fingerprint of a service, computed deterministically at compile time from its functions, events, and base services. The key property: every program that implements the same interface gets the same ID. Not "similar" — identical.

This means an off-chain tool doesn't need to verify bytecode or query a registry to know what kind of contract it's talking to. If messages are coming in with the `FungibleToken` Interface ID, you can optimistically treat it as a token. A wallet can render a "Transfer" screen immediately. An indexer can filter for all NFT transfers across the whole network with a single field comparison.

```
                   Vara network message arrives

      ┌─────────────────────────────────────────────────┐
      │   Header (16 bytes)          │     Payload      │
      └─────────────────────────────────────────────────┘
                    │
                    ▼
       Interface ID = 0xa3f29c11…      ← known fingerprint
                    │
           ┌────────┴────────┐
           │                 │
           ▼                 ▼
      💳 Wallet          🔍 Indexer
    renders "Transfer"  filters "NFT transfers"
    UI instantly        network-wide, no ABI needed
```

It's duck typing, but for smart contracts — and it works without any on-chain coordination.

## What the Header Actually Looks Like

Each Sails message starts with a fixed 16-byte preamble:

```
Byte  0    1    2    3    4    5    6    7    8    9   10   11   12   13   14   15
     ┌────┬────┬────┬────┬────────────────────────────────┬──────────┬──────┬──────┐
     │ 47 │ 4D │ 01 │ 10 │     Interface ID  (8 bytes)    │ Entry ID │  Rt  │  00  │
     │'G' │'M' │ v1 │len │                                │ (2 bytes)│  Idx │  rsv │
     └────┴────┴────┴────┴────────────────────────────────┴──────────┴──────┴──────┘
      ◄────────────►       ◄──────────────────────────────────────────────────────────►
          Magic                         routing fields                  then payload →
```

- **Magic `GM`** — parsers skip non-Sails messages instantly
- **Interface ID** — which service (e.g. FungibleToken, DaoVoting)
- **Entry ID** — which method within that service
- **Route Index** — which instance, if a program hosts multiple services
- **Reserved byte** — always `0x00` in v1; reserved for future versions

## Routing Gets Cheaper

There's an underrated benefit on the contract side too. Here's what routing looked like before versus now:

```
Before: string matching
─────────────────────────────────────────────────────────────
  payload → read bytes → allocate string → strcmp()
                                               │
                               "VFT.Transfer"? → handler A
                               "VFT.Approve"?  → handler B
                               "DAO.Vote"?     → handler C

  Cost: heap allocations + byte-by-byte comparisons + typo risk


After: integer dispatch
─────────────────────────────────────────────────────────────
  header → read 8 bytes (interface_id)
         → read 2 bytes (entry_id)
         → jump table

  0xa3f2… + 0x0002  ──►  handler B

  Cost: two integer comparisons, O(1), zero allocations
```

No string vulnerabilities, no gas wasted on parsing, no typos in method names causing silent failures.

## Route Inference and the Zero Sentinel

The `route_id` field has a subtle design worth knowing if you're building tooling.

`0x00` isn't "the first route" — it's a sentinel that means *figure it out if there's no ambiguity*. If the target program has exactly one instance of the given `interface_id`, the receiver resolves the route automatically. If there are multiple instances, the message is rejected as ambiguous. This sidesteps a footgun where zero would silently route to the wrong service.

Non-zero values are explicit: they map to named route instances via a per-program manifest. The spec deliberately leaves that manifest format up to implementations — it can be embedded in the IDL, distributed alongside the binary, or hardcoded in the client.

One consequence for off-chain tools: when you see `route_id = 0x00`, you can't assume there's only one service. Check first.

## How the Interface ID Is Computed

The fingerprint is built from three layers, hashed together with Keccak256 at compile time:

```
  ┌──────────────────────────────────────────────────────────┐
  │  FUNCTIONS  (sorted lexicographically)                   │
  │                                                          │
  │  transfer(to: ActorId, amount: u128) → Result<(), Error> │
  │    → type=Command, name, args via ReflectHash, T + E     │
  │                                                          │
  │  balance_of(account: ActorId) → u128                     │
  │    → type=Query, name, args via ReflectHash, return type │
  └────────────────────────┬─────────────────────────────────┘
                           │
  ┌────────────────────────▼─────────────────────────────────┐
  │  EVENTS                                                  │
  │                                                          │
  │  enum Event { Transfer { from, to, value }, Approval {}} │
  │  adding a new variant changes the ID → signals upgrade   │
  └────────────────────────┬─────────────────────────────────┘
                           │
  ┌────────────────────────▼─────────────────────────────────┐
  │  BASE SERVICES                                           │
  │                                                          │
  │  extends BaseService  →  mix in its Interface ID         │
  │  proves which exact version of the base is implemented   │
  └────────────────────────┬─────────────────────────────────┘
                           │
                           ▼
                  Keccak256( F ‖ E ‖ B )
                           │
                      take [0..8]
                           │
                           ▼
               Interface ID = 0xa3f29c11e8d04f02
```

A few details worth noting:

- `Result<T, E>` — both `T` and `E` are hashed. Error handling is part of the interface contract, not an afterthought.
- Protocol wrappers like `CommandReply<T>` are stripped before hashing — the ID reflects business logic, not transport.
- Base service IDs are mixed in recursively, creating a chain of trust in 8 bytes.
- **The service name is deliberately excluded.** You can rename a service without breaking the wire protocol — the ID only changes when the actual structure changes.

That last point is an intentional tradeoff: stability over nominality. Two services named differently but structurally identical will share an ID. Whether that's a feature or a footgun depends on your use case, but for tooling it means you can't infer the name from the ID alone — you still need the IDL for that.

Commands/queries and events also have independent `entry_id` spaces, both starting at zero. Keep that in mind when decoding: `entry_id = 1` means different things depending on whether you're looking at a function call or an event.

## Zero Runtime Cost

For Rust: all of this happens in `build.rs`. The compiler embeds the IDs as constants. At runtime the program writes a static byte array. There's no hashing at message time, no gas spent on it.

## The Path Forward

The base header is fixed at 16 bytes, but `header_len` (byte 3) can go higher. Extensions use a TLV format — `type_id (u8)`, `flags (u8)`, `length (u16)`, `data` — appended immediately after the base fields. Unknown `type_id`s are skipped by their declared length, so future extensions are forward-compatible by design. `type_id = 0` is reserved and must never appear on the wire. The obvious first candidate is correlation IDs for tracing async message chains.

The reserved byte at offset 15 is always `0x00` in v1. Future versions may repurpose it — receivers should reject v1 headers where it's non-zero.

The versioning and extension design was deliberate: define something stable enough to build tooling on, flexible enough not to need replacing in two years.

### Key Technical Specs

| Field | Size | Description |
|---|---|---|
| **Magic** | 2 bytes | `0x47 0x4D` ("GM") |
| **Version** | 1 byte | `0x01` |
| **Header Len** | 1 byte | Offset to payload (default `0x10`) |
| **Interface ID** | 8 bytes | `Keccak256(Functions ‖ Events ‖ BaseServices)[0..8]` |
| **Entry ID** | 2 bytes | Lexicographically sorted method index |
| **Route Index** | 1 byte | Instance identifier (`0x00` = infer if unambiguous) |
| **Reserved** | 1 byte | Must be `0x00` in v1 |

---

*Ready to build? Check out the [Sails Repository](https://github.com/gear-tech/sails) to get started.*
