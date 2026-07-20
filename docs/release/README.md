# Release documentation

BuBu release engineering is implemented, but public distribution remains blocked until real signing identities and native evidence exist. Read these documents in order:

1. [Platform and release support](platform-support.md) defines the stable operating systems, architectures, artifacts, version rule, and deliberate exclusions.
2. [Release runbook](release-runbook.md) defines the protected GitHub environment, credentials, version/tag commands, automated jobs, failure recovery, and draft-publication review.
3. [Public beta readiness](public-beta-readiness.md) records what the repository proves and which external facts still block a public release.

The release workflows never turn an unsigned artifact into a public claim. Pull requests build unsigned native installers with no signing credentials; an exact version tag runs protected signing jobs and creates or refreshes a draft GitHub Release only after every target and evidence gate succeeds.
