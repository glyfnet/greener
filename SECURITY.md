# Security Policy

## Reporting a vulnerability

Please report security vulnerabilities privately rather than through a
public GitHub issue. Open a [GitHub Security Advisory](../../security/advisories/new)
on this repository, or contact the maintainer directly through the
repository's GitHub profile.

Please include:

- A description of the vulnerability and its potential impact
- Steps to reproduce
- Any relevant logs or proof-of-concept code

## Scope

Greener's server keeps no user data (D-09 in `docs/specification.md`):
no site location, profile, plan, or user document persists after a tool
call ends. The server only fetches from a fixed, known set of public API
hosts — never a URL supplied by a user. Reports affecting this guarantee
are treated as high priority.

## Response

We aim to acknowledge reports within 7 days. Fixes are released through
the manual release process in specification Section 11.3.
