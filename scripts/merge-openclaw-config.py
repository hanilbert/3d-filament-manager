#!/usr/bin/env python3
"""Merge OpenClaw config fragment into existing config. Run on remote."""
import json
from pathlib import Path

CONFIG_PATH = Path("/Users/old_youth/.openclaw/openclaw.json")
NEXUS_API_KEY = "cr_fa7ae0e97eb6d699419dd02dedf5e899d6b9c928ac5d2a5443ae30ad0b8750b8"

FRAGMENT = {
  "agents": {
    "defaults": {
      "workspace": "~/clawd",
      "model": {
        "primary": "nexus/claude-opus-4-6-20260205"
      },
      "compaction": {
        "mode": "safeguard",
        "reserveTokensFloor": 40000
      },
      "thinkingDefault": "high",
      "timeoutSeconds": 900,
      "maxConcurrent": 4,
      "subagents": {
        "maxConcurrent": 8
      }
    }
  },
  "models": {
    "mode": "merge",
    "providers": {
      "nexus": {
        "baseUrl": "https://crs2acc.itssx.com/api",
        "apiKey": NEXUS_API_KEY,
        "api": "anthropic-messages",
        "models": [
          {
            "id": "claude-sonnet-4-5-20250929",
            "name": "Claude Sonnet 4.5",
            "contextWindow": 200000,
            "maxTokens": 64000,
            "reasoning": True,
            "input": ["text","image"],
            "cost": { "input": 3, "output": 15, "cacheRead": 0.3, "cacheWrite": 3.75 }
          },
          {
            "id": "claude-sonnet-4-6",
            "name": "Claude Sonnet 4.6",
            "contextWindow": 200000,
            "maxTokens": 64000,
            "reasoning": True,
            "input": ["text","image"],
            "cost": { "input": 3, "output": 15, "cacheRead": 0.3, "cacheWrite": 3.75 }
          },
          {
            "id": "claude-opus-4-5-20251101",
            "name": "Claude Opus 4.5",
            "contextWindow": 200000,
            "maxTokens": 64000,
            "reasoning": True,
            "input": ["text","image"],
            "cost": { "input": 5, "output": 25, "cacheRead": 0.5, "cacheWrite": 6.25 }
          },
          {
            "id": "claude-opus-4-6-20260205",
            "name": "Claude Opus 4.6",
            "contextWindow": 200000,
            "maxTokens": 128000,
            "reasoning": True,
            "input": ["text","image"],
            "cost": { "input": 5, "output": 25, "cacheRead": 0.5, "cacheWrite": 6.25 }
          }
        ]
      }
    }
  },
  "messages": {
    "ackReactionScope": "group-mentions"
  },
  "commands": {
    "native": "auto",
    "nativeSkills": "auto"
  },
  "gateway": {
    "port": 18789,
    "mode": "local",
    "bind": "lan",
    "auth": {
      "mode": "token",
      "token": "openclaw"
    },
    "tailscale": {
      "mode": "off",
      "resetOnExit": False
    }
  },
  "skills": {
    "install": {
      "nodeManager": "npm"
    }
  }
}

def deep_merge(base: dict, override: dict) -> dict:
    out = dict(base)
    for k, v in override.items():
        if k in out and isinstance(out[k], dict) and isinstance(v, dict):
            out[k] = deep_merge(out[k], v)
        else:
            out[k] = v
    return out

def main():
    cfg = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    merged = deep_merge(cfg, FRAGMENT)
    # Ensure nexus apiKey is set
    merged.setdefault("models", {}).setdefault("providers", {}).setdefault("nexus", {})["apiKey"] = NEXUS_API_KEY
    CONFIG_PATH.write_text(json.dumps(merged, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("merged")

if __name__ == "__main__":
    main()
