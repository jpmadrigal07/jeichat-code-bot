import { Redis } from "@upstash/redis";

const DEFAULT_TTL_SECONDS = 7 * 24 * 60 * 60;

function redisKey(channelId) {
  return `jeichat-code-bot:planning:${channelId}`;
}

function baseRefRedisKey(channelId) {
  return `jeichat-code-bot:base-ref:${channelId}`;
}

function createMemoryStore(ttlSeconds) {
  const map = new Map();
  const baseRefMap = new Map();

  return {
    async get(channelId) {
      const row = map.get(channelId);
      if (!row) return null;
      if (row.expiresAt <= Date.now()) {
        map.delete(channelId);
        return null;
      }
      return row.agentId;
    },
    async set(channelId, agentId) {
      map.set(channelId, {
        agentId,
        expiresAt: Date.now() + ttlSeconds * 1000,
      });
    },
    async clear(channelId) {
      map.delete(channelId);
    },
    async getBaseRef(channelId) {
      const row = baseRefMap.get(channelId);
      if (!row) return null;
      if (row.expiresAt <= Date.now()) {
        baseRefMap.delete(channelId);
        return null;
      }
      return row.ref;
    },
    async setBaseRef(channelId, ref) {
      baseRefMap.set(channelId, {
        ref,
        expiresAt: Date.now() + ttlSeconds * 1000,
      });
    },
    async clearBaseRef(channelId) {
      baseRefMap.delete(channelId);
    },
  };
}

function createRedisStore(redis, ttlSeconds) {
  return {
    async get(channelId) {
      const value = await redis.get(redisKey(channelId));
      return typeof value === "string" && value.trim() ? value.trim() : null;
    },
    async set(channelId, agentId) {
      await redis.set(redisKey(channelId), agentId, { ex: ttlSeconds });
    },
    async clear(channelId) {
      await redis.del(redisKey(channelId));
    },
    async getBaseRef(channelId) {
      const value = await redis.get(baseRefRedisKey(channelId));
      return typeof value === "string" && value.trim() ? value.trim() : null;
    },
    async setBaseRef(channelId, ref) {
      await redis.set(baseRefRedisKey(channelId), ref, { ex: ttlSeconds });
    },
    async clearBaseRef(channelId) {
      await redis.del(baseRefRedisKey(channelId));
    },
  };
}

export function createPlanningStore() {
  const ttlSeconds = Number(
    process.env.PLANNING_AGENT_TTL_SECONDS?.trim() || DEFAULT_TTL_SECONDS,
  );
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (url && token) {
    return createRedisStore(new Redis({ url, token }), ttlSeconds);
  }
  return createMemoryStore(ttlSeconds);
}
