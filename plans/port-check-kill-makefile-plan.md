# Plan: Add Port Check & Kill Targets to Makefile

## Goal

Add Makefile targets to check port occupancy and kill processes on specified ports, following the existing project's Makefile conventions.

## Background

This React Native project (`frontend-blog-mobile`) uses a Makefile for dev / staging / production workflows. Common port conflicts occur with Metro bundler (port 8081) and other tools. Adding port-management targets streamlines debugging these conflicts.

## Proposed New Section: `# ── Port Management ──`

Added between existing sections (e.g., after `# ── Environment Diagnostics ──` or `# ── Cleanup & Reset ──`).

### Targets

| Target | Usage | Description |
|--------|-------|-------------|
| `ports` | `make ports` | Show occupancy of all common React Native ports in a table (8081, 8088, 19000, 19001, 3000, 4000) |
| `port-ls` | `make port-ls PORT=8081` | Show detailed process info for a specific port via `lsof` |
| `port-kill` | `make port-kill PORT=8081` | Kill the process occupying a specific port with interactive confirmation |
| `port-kill-metro` | `make port-kill-metro` | Convenience shortcut: kill Metro bundler on port 8081 |

### Design Details

#### `ports` — Show All Common Ports
```makefile
ports: ## Show occupancy of all common React Native ports
	@echo "━━━ Port Occupancy ━━━"
	@for port in 8081 8088 19000 19001 3000 4000; do \
		pid=$$(lsof -ti :$$port 2>/dev/null); \
		if [ -n "$$pid" ]; then \
			name=$$(lsof -ti :$$port -c 2>/dev/null | xargs ps -o comm= -p 2>/dev/null || echo "unknown"); \
			echo "  🔴 Port $$port — in use by PID $$pid ($$name)"; \
		else \
			echo "  🟢 Port $$port — free"; \
		fi; \
	done
```

#### `port-ls` — Detailed Check
```makefile
port-ls: ## Show process info for a specific port. Usage: make port-ls PORT=8081
	@if [ -z "$(PORT)" ]; then \
		echo "⚠️  Usage: make port-ls PORT=<number>"; \
		echo "   Common ports: 8081 Metro, 8088 Expo, 19000/19001 Expo, 3000 web, 4000 API"; \
		exit 1; \
	fi; \
	echo "🔍 Checking port $(PORT)..."; \
	lsof -i :$(PORT) -P -n || echo "✅ Port $(PORT) is free"
```

#### `port-kill` — Kill with Confirmation
```makefile
port-kill: ## Kill process on a specific port. Usage: make port-kill PORT=8081
	@if [ -z "$(PORT)" ]; then \
		echo "⚠️  Usage: make port-kill PORT=<number>"; \
		echo "   Common ports: 8081 Metro, 8088 Expo, 19000/19001 Expo, 3000 web, 4000 API"; \
		exit 1; \
	fi; \
	pid=$$(lsof -ti :$(PORT) 2>/dev/null); \
	if [ -z "$$pid" ]; then \
		echo "✅ Port $(PORT) is already free — nothing to kill"; \
		exit 0; \
	fi; \
	name=$$(ps -o comm= -p $$pid 2>/dev/null || echo "unknown"); \
	echo "🔴 Port $(PORT) is occupied by PID $$pid ($$name)"; \
	read -p "❓ Kill process $$pid? [y/N] " answer; \
	if [ "$$answer" = "y" ] || [ "$$answer" = "Y" ]; then \
		kill $$pid 2>/dev/null && echo "✅ Killed PID $$pid" || \
		(kill -9 $$pid 2>/dev/null && echo "✅ Force-killed PID $$pid (SIGKILL)"); \
	else \
		echo "⏭️  Skipped"; \
	fi
```

#### `port-kill-metro` — Convenience Shortcut
```makefile
port-kill-metro: ## Kill Metro bundler on port 8081
	$(MAKE) port-kill PORT=8081
```

### `.PHONY` Update

Append to the existing `.PHONY` line (or the correct line next to other task-related phony targets):

```
port-ls port-kill port-kill-metro ports
```

### Dependencies / Prerequisites

- `lsof` — built-in on macOS
- `ps` — built-in on macOS
- All commands are native to macOS `/bin/zsh` (the project's `SHELL`)

### Safety Considerations

- `port-kill` requires **interactive confirmation** before killing (reads `y/N` from stdin)
- `port-kill-metro` inherits the same safety via delegation
- `port-ls` and `ports` are read-only — no risk
- If `SIGTERM` fails, falls back to `SIGKILL` (`kill -9`)

## Implementation Steps

1. Add the new `# ── Port Management ──` section to [`Makefile`](../Makefile) (suggested location: after the `# ── Environment Diagnostics ──` section, before the last empty line)
2. Append `port-ls port-kill port-kill-metro ports` to the `.PHONY` declaration
3. Verify with `make help` that new targets appear
4. Test with `make ports`, `make port-ls PORT=8081`, and `make port-kill PORT=8081`
