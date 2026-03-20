# Platform Parity Roadmap

This roadmap focuses on one question:

How do we expand VoxVera beyond Linux without overstating reliability, while still converging on real cross-platform parity for Tor hidden-service hosting?

## Strategic Principle

Parity is not a packaging milestone. It is a runtime-contract milestone.

Every platform must eventually implement the same hosting contract:

1. install VoxVera
2. ensure Tor and OnionShare are available
3. build site assets
4. serve the hidden service
5. preserve `.onionshare-session`
6. recover hosting after reboot, login, suspend, or offline periods
7. surface logs and status

Package formats should inherit that contract. They should not define independent behavior.

## Phase 0: Truth Alignment

Goal: bring repo claims, docs, and release posture into line with current reality.

Deliverables:

- canonical support matrix
- machine-readable support declaration
- installer/package warnings for experimental paths
- README and docs aligned to the actual supported target

Definition of done:

- no docs imply parity that tests do not support
- every platform surface has an explicit support tier
- release artifacts are not treated as proof of hosting reliability

## Phase 1: Harden Linux As Reference

Goal: make Linux CLI with `systemd --user` the clearly defensible model that other platforms copy.

Work items:

1. Add `voxvera doctor` for runtime validation.
   - Check Tor reachability.
   - Check OnionShare availability.
   - Check `start-all` surfaces.
   - Check autostart timer installation.
   - Check host directories and session files.

2. Add `voxvera autostart status`.
   - Show service and timer files.
   - Show whether the timer is enabled.
   - Show next/last run timestamps if available.

3. Normalize Linux log/status guidance.
   - Document host log paths.
   - Document timer/service status commands.
   - Document expected recovery flow after reboot/network loss.

4. Validate restart behavior.
   - fresh install
   - first serve
   - reboot
   - suspend/resume if possible
   - temporary offline period followed by reconnect

Definition of done:

- Linux remains the only `supported` path until the above evidence exists and is documented.

## Phase 2: Platform Adapter Layer

Goal: stop encoding platform logic in ad hoc installer scripts.

Recommended structure:

- `voxvera/platforms/base.py`
- `voxvera/platforms/linux.py`
- `voxvera/platforms/macos.py`
- `voxvera/platforms/windows.py`
- `voxvera/platforms/docker.py`

Each adapter should define:

- support tier
- Tor discovery strategy
- OnionShare discovery strategy
- state root
- autostart installation strategy
- autostart status strategy
- log/status surface
- known limitations

CLI surfaces to add:

- `voxvera doctor`
- `voxvera platform-status`
- `voxvera autostart`
- `voxvera autostart status`
- `voxvera autostart uninstall`

Definition of done:

- shell installers become thin wrappers over shared Python logic instead of owning runtime policy themselves

## Phase 3: Docker Beta Candidate

Goal: make Docker a coherent, testable deployment surface.

Decisions to settle:

- single-container runtime vs compose-based runtime
- host Tor vs container Tor
- log and state persistence model

Recommended direction:

- keep runtime state under one explicit volume root
- document restart policy clearly
- make health and recovery behavior observable

Validation checklist:

- container restart preserves onion identity
- host reboot with restart policy restores hosting
- state remains in mounted volume
- logs remain inspectable

Promotion target:

- `experimental` -> `beta`

## Phase 4: macOS CLI

Goal: establish one honest CLI-based macOS hosting model before packaging.

Work items:

1. define Tor discovery strategy
2. define OnionShare discovery/install strategy
3. validate manual `build` + `serve`
4. implement and validate `launchd` recovery
5. document known limitations

Promotion target:

- remain `experimental` until `launchd` recovery is validated
- move to `beta` only after login/reboot/offline recovery evidence exists

## Phase 5: Windows CLI

Goal: establish one canonical Windows runtime model before claiming package parity.

Work items:

1. unify binary naming across installer, Chocolatey, docs, and release assets
2. define Tor discovery strategy
3. define OnionShare discovery strategy
4. validate manual `build` + `serve`
5. implement Task Scheduler recovery path
6. add Windows-specific status/log guidance

Promotion target:

- remain `experimental` until scheduled recovery and state persistence are proven
- move to `beta` only after reboot/login/offline recovery evidence exists

## Phase 6: Electron GUI Convergence

Goal: make the GUI a frontend to the supported runtime, not a separate runtime.

Work items:

1. route the GUI through shared CLI/runtime surfaces
2. reduce duplicated Tor startup behavior
3. add visibility for:
   - Tor status
   - OnionShare status
   - hosting status
   - onion URL
   - logs
4. make window-close behavior explicit and safe

Promotion target:

- GUI remains `experimental` until it stops diverging from the CLI runtime contract

## Phase 7: Package Surface Promotion

Goal: package formats should become trustworthy wrappers around validated runtimes.

Work items:

1. Debian package
   - declare actual runtime dependencies
   - validate install + host + recovery path

2. AppImage
   - decide whether it is distribution-only or a real hosting target

3. Homebrew
   - fix artifact URL/sha/version policy
   - clarify whether it installs a hosting target or just a CLI

4. Chocolatey
   - align artifact naming and installer semantics

5. Flatpak
   - decide whether Tor/OnionShare can be supported sanely in-sandbox

Rule:

- no package surface should be promoted above the support tier of its underlying runtime

## Testing Program

### 1. Unit tests

- config/state logic
- autostart file generation
- platform adapter selection

### 2. Mocked integration tests

- `serve`
- `autostart`
- `doctor`
- `platform-status`

### 3. Platform smoke tests

- fresh install
- build
- serve
- persist identity
- restart
- recover

Current smoke target names:

- `linux-cli`
- `macos-cli`
- `windows-cli`
- `docker-cli`

These target names are contract-level validation entry points. Only `linux-cli` currently represents a supported hosting path; the others should be used to validate experimental posture and dependency discovery on their native platforms until their recovery behavior is proven.

### 4. Release checks

- support matrix is current
- docs match support tiers
- artifact names match scripts and package manifests

## Immediate Next Tasks

1. Add `voxvera doctor`.
2. Add `voxvera autostart status`.

## Native Validation Assets

The repo now includes concrete native-host validation docs for the two major experimental desktop targets:

- `docs/macos-validation-checklist.md`
- `docs/windows-validation-checklist.md`
- `docs/native-tester-guide.md`

These should be used for the first real macOS/Windows validation cycles so testers capture the runtime evidence needed for future tier promotion.
3. Add the platform adapter scaffold.
4. Capture Linux reboot/offline recovery validation steps in docs and CI notes.
5. Pick Docker's canonical runtime model.
6. Normalize Windows binary naming before further Windows work.

## Non-Goals

- claiming parity before recovery behavior is validated
- treating package availability as support proof
- maintaining separate runtime semantics in GUI vs CLI
