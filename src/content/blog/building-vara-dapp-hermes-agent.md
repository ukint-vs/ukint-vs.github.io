---
title: "Building a Vara DApp with Hermes Agent — From Spec to Mainnet"
date: 2026-04-01
description: "How I set up a Hermes agent, installed vara-skills and vara-wallet, and built a full dApp from scratch — smart contract, tests, CLI client, and a new frontend."
tags: ["AI", "hermes", "vara", "vara-skills", "vara-wallet", "sails", "agent-development"]
giscus: true
toc: true
---

# Building a Vara DApp with Hermes Agent

I set up a Hermes agent, installed the vara-skills and vara-wallet CLI, and built a full on-chain game from scratch — smart contract, tests, CLI client, and a new React frontend. Here's exactly how it went down.

## The Stack

- **[Hermes Agent](https://hermes-agent.nousresearch.com/docs/getting-started/installation)** — the AI runtime (Claude Opus as the brain)
- **[vara-skills](https://github.com/gear-foundation/vara-skills)** — Gear/Vara builder skill pack that teaches the agent Sails, gtest, IDL, deployment
- **[vara-wallet](https://github.com/nickvdyck/vara-wallet)** — CLI for on-chain interactions (queries, transactions, vouchers)

## Step 1: Install Hermes

```bash
curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash
source ~/.bashrc
hermes setup
```

That's it for the base install. The interesting part is the configuration.

## Step 2: Configure for Vara Development

The default Hermes config is designed for lightweight chat. Building Rust/WASM smart contracts needs more resources and smarter model routing. Here's what I changed from defaults in `~/.hermes/config.yaml`:

### Model Selection

```yaml
model:
  default: claude-opus-4-6
  provider: anthropic
```

Opus for the main brain. It handles Rust, async message flows, and commit-reveal cryptography without hand-holding.

### Cheaper Alternatives to Opus

Opus is the best for complex Rust/WASM work, but not every task needs it. For cron jobs, routine checks, and background tasks, use cheaper models via OpenRouter:

| Model | Cost | Best For |
|-------|------|----------|
| **Qwen 3.6 Plus Preview** | Free | Main model if you don't have a Claude plan. Strong reasoning, good for code review and spec work |
| **MiniMax M2.7** | $0.30/$1.20 per 1M | Context compression, subagent delegation, routine monitoring |
| **Claude Sonnet** | Paid | Coding tasks when Opus is overkill |

No plan at all? Start with `qwen/qwen3.6-plus-preview:free` on OpenRouter — it's the best free model for this kind of work.

Set per-task model overrides in cron jobs instead of switching the main model. Keep Opus (or your main model) for direct coding sessions where quality matters.

### Context Compression

```yaml
compression:
  enabled: true
  threshold: 0.7
  target_ratio: 0.2
  protect_last_n: 20
  summary_model: minimax/minimax-m2.7
  summary_provider: openrouter
```

A 2-hour build session generates a massive context window — Rust compiler errors, test outputs, IDL dumps. Compression kicks in at 70% context usage and summarizes older turns using a cheap model (MiniMax M2.7), while protecting the last 20 turns so the agent never loses its immediate working memory. Without this, you hit context limits mid-build.

### Subagent Delegation

```yaml
delegation:
  model: minimax/minimax-m2.7
  provider: openrouter
```

When the agent needs to research something (check Sails docs, look up an API) it spawns a subagent on a cheap model instead of burning Opus tokens on web searches.

### Docker Terminal — The Key Setup

```yaml
terminal:
  backend: docker
  docker_image: nikolaik/python-nodejs:python3.11-nodejs20
  container_cpu: 4.0
  container_memory: 12288
  container_disk: 102400
  container_persistent: true
  docker_mount_cwd_to_workspace: false
  persistent_shell: true
  lifetime_seconds: 3600
```

The agent needs a real terminal to compile Rust, run tests, and deploy. Docker gives it an isolated sandbox with 4 CPUs and 12GB RAM — enough for `cargo build` with the WASM target.

### Docker Volumes — Persistent Tooling

```yaml
  docker_volumes:
    - /Users/<username>/workspace:/workspace
    - /Users/<username>/hermes-outputs:/outputs
    - /Users/<username>/.hermes-tools:/tools
```

Three mounts that make the agent's work persist across sessions:

- **`/workspace`**: The working directory where code lives. Persists between container restarts.
- **`/outputs`**: Where the agent saves built artifacts (WASM binaries, IDL files, frontends). I can browse the results from my host machine.
- **`/tools`**: Pre-installed tooling (Rust toolchain, vara-wallet, sails-cli) that survives container restarts. The agent runs `source /tools/.bashrc` at session start to get its full environment. Without this, every new session would spend 10 minutes reinstalling Rust.

### Max Turns

```yaml
agent:
  max_turns: 90
  reasoning_effort: medium
```

Default is lower. Building a dApp from scratch takes many iterations — write code, compile, hit error, fix, recompile, write tests, run tests, fix again. 90 turns gives the agent enough runway to finish without hitting a wall.

## Step 3: Install vara-skills and vara-wallet

Inside the agent's terminal (or via Hermes chat):

```bash
# Install the Vara builder skill pack
npx skills add gear-foundation/vara-skills -g --all -y --copy

# Install the wallet CLI
npm install -g @gear-js/vara-wallet

# Create the agent's wallet
vara-wallet create --name agent

# Fund it (testnet faucet or transfer)
# Check balance
vara-wallet balance
```

Now the agent knows how to build Sails programs, write gtest tests, generate IDL files, scaffold frontends, and deploy — all from its skill memory.

## Step 4: From Spec to Build

The prompt was "Go." — but only after we defined the full spec together. The agent wrote the game design doc before touching code:

1. **Spec & Architecture**: Commit-reveal mechanics, Sails services (CreateGame, JoinGame, Reveal, queries), forfeit logic
2. **Skill Selection**: 13 skills loaded — 8 vara-skills (sails-new-app, sails-rust-implementer, sails-gtest, gtest-tdd-loop, vara-wallet, etc.) + 5 general dev skills (test-driven-development, plan, systematic-debugging, etc.)
3. **Scaffold**: Created the Sails project structure (`cargo sails new` + `sails-new-app` skill)
4. **Implement**: Commit-reveal logic in Rust — hash moves with salts, enforce reveal timeouts, track leaderboard
5. **Test**: 8 gtest tests covering all game states, forfeits, edge cases
6. **Fix its own errors**: Hit a Sails 0.10.3 `UnsafeCell` compiler issue, found the workaround, patched the skill file
7. **Deploy to testnet, then mainnet** after approval

## Step 5: The Frontend — From Scratch

This is where I wanted to explore new UX/UI ideas. The standard Vara frontend template (`@gear-js/react-hooks` + SubWallet) works but feels clunky. I wanted:

- **Single-page flow**: No tabs. The entire game state (open games, your active game, leaderboard) visible at once.
- **Auto-polling**: The UI watches the chain and updates automatically. No "refresh" button.
- **Move persistence**: The secret salt is saved to `localStorage` immediately after commit. If you close the tab, you can still reveal. Losing your salt = losing the game, so this is critical UX.

I told the agent to build the frontend with React + Vite + Tailwind, using the IDL to generate TypeScript types via `sails-js`. It wrote it from scratch — no bootstrap template.

Key pitfall we discovered: `@polkadot/api` 16.5.x breaks standard Sails queries. Pin to 16.4.8.

## The Result

- **Live on mainnet**: `0x1de134d3...ff43cfa`
- **Live on testnet**: `0x02e1e2f3...b79495`
- **1000 VARA bounty** on both networks
- **Play from CLI** in 5 commands or via the web UI

```bash
# Play from terminal
ARENA=0x1de134d3723429b48552e5dc83264ca9124ca1ea99a781de41d6311abff43cfa
IDL=rps_arena.idl

vara-wallet call $ARENA Rps/OpenGames --idl $IDL
vara-wallet call $ARENA Rps/ComputeCommitment --args '["Rock", "my_secret"]' --idl $IDL
vara-wallet --account player call $ARENA Rps/CreateGame --args '["0xYOUR_HASH"]' --idl $IDL
vara-wallet --account player call $ARENA Rps/Reveal --args '[1, "Rock", "my_secret"]' --idl $IDL
vara-wallet call $ARENA Rps/Leaderboard --idl $IDL
```

Or play in the browser: [ukint-vs.github.io/rps-arena](https://ukint-vs.github.io/rps-arena/)

## Why Vara for Agent Development

Vara's actor model mirrors how agents think. Every program is an isolated actor with its own state and mailbox. When my agent sends a message to the RPS contract, it's one actor talking to another. The architecture isn't forced — it's native.

Key Vara features that made this work:
- **Delayed messages**: Built-in timeout mechanism (200 blocks ≈ 10 min). No external keeper needed.
- **Vouchers**: Gas sponsorship for new players. The agent can issue vouchers so opponents play for free.
- **IDL-first development**: The IDL file is the contract's API spec. The frontend, CLI client, and tests all generate from the same source of truth.

## What I Learned

1. **Docker volumes are essential.** Without persistent `/tools`, every session wastes 10 minutes on setup.
2. **Spec before code saves iterations.** The agent wrote the full game design (services, states, forfeit logic) before touching Rust. Starting with a spec prevented rewrites.
3. **Use cheap models for background tasks.** Opus for coding, but MiniMax M2.7 and Qwen 3.6 Plus Preview (`qwen/qwen3.6-plus-preview:free`) handle compression, research, and cron jobs at a fraction of the cost.
4. **The agent self-improves.** When it hits an error, it patches its own skill files. The next build session starts with better knowledge.
5. **Frontend UX needs human direction.** The agent builds what you describe, but "make it not suck" requires you to articulate what good UX means. Single-page, auto-poll, localStorage persistence — those were my calls.

---

Built by Vadim Smirnov ([@ukint-vs](https://github.com/ukint-vs)) and Nexus (Hermes Agent / Claude)

[Source](https://github.com/ukint-vs/rps-arena) · [vara-skills](https://github.com/gear-foundation/vara-skills) · [vara-wallet](https://github.com/ukint-vs/vara-wallet) · [Hermes Agent](https://hermes-agent.nousresearch.com/docs/getting-started/installation)
