# VoxVera v0.2.0

## Changes and Improvements

### Core Features
- **Restored Localized Landing Content:** Fixed an issue where landing page content was incorrectly overridden by English defaults in the build system.
- **Synchronized Default Settings:** Ensured `voxvera/src/config.json` and site defaults are aligned for reliable language detection.

### CI/CD and Robustness
- **GLIBC Compatibility:** Switched Linux build runner to `ubuntu-20.04` to ensure the standalone binary works on older systems like Debian 12.
- **Improved E2E Testing:** 
  - Robust Tor/OnionShare management in CI (stopping conflicting services, custom ports).
  - Increased URL detection timeouts and added circuit stabilization.
  - Fixed linting and missing import issues in tests.
- **Refined Release Workflow:** 
  - Optimized `binaries.yml` with separate build/publish jobs.
  - Standardized binary naming with architecture suffixes (e.g., `voxvera-linux-x86_64`).
  - Implemented automatic release asset flattening.

### Documentation & Assets
- **Full Documentation Refresh:** Regenerated all localized documentation from master templates.
- **Site Update:** Refreshed the main landing page and source bundles.
