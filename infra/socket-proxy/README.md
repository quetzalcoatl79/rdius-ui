# Docker Socket Proxy

## Purpose

The `socket-proxy` service is a security boundary between the backend container and the Docker daemon.

**Without this proxy:** The backend would need to mount `/var/run/docker.sock` directly, which grants
full root-equivalent access to the Docker host. A single compromised endpoint in the backend
(SSRF, RCE, dependency vulnerability) would give an attacker complete host access — they could
create privileged containers, mount the host filesystem, and exfiltrate all data.

**With this proxy:** The backend connects to `tcp://socket-proxy:2375` over an isolated internal
network (`socket-proxy-net`). The proxy forwards only explicitly allowed Docker API calls.

## What This Proxy Allows

| Capability | Config Variable | Why Needed |
|------------|----------------|------------|
| Container inspection | `CONTAINERS=1` | Backend needs to read container status and labels to discover FreeRADIUS instances |
| POST requests | `POST=1` | Required to send restart/kill signals |
| Kill signals | `KILL=1` | Backend sends SIGHUP (reload) and restart to FreeRADIUS containers |

## What This Proxy Denies

| Capability | Config Variable | Why Denied |
|------------|----------------|------------|
| Network management | `NETWORKS=0` | No reason for backend to create/modify networks |
| Image management | `IMAGES=0` | No reason for backend to pull/delete images |
| Volume management | `VOLUMES=0` | No reason for backend to create/delete volumes |
| Auth | `AUTH=0` | Not needed |
| Secrets | `SECRETS=0` | Never expose secrets via API |

## Network Isolation

The socket proxy is on an isolated `socket-proxy-net` network. Only the `backend` service can
reach it. FreeRADIUS instances, the frontend, and PostgreSQL are on `radius-net` and cannot
reach the Docker socket at all.

```
[frontend]  ──┐
[postgres]  ──┤  radius-net
[freeradius]──┘

[backend]  ──── radius-net  (connects to postgres, freeradius)
[backend]  ──── socket-proxy-net  (connects to socket-proxy ONLY)

[socket-proxy] ── socket-proxy-net ── /var/run/docker.sock (read-only mount)
```

## References

- CP-4 from `.planning/research/PITFALLS.md` — Docker socket = root access
- [Tecnativa/docker-socket-proxy](https://github.com/Tecnativa/docker-socket-proxy)
- [Docker API security](https://docs.docker.com/engine/security/)
