local api_key = KEYS[1]
local usage_key = KEYS[2]

-- Fetch API key details from Redis
local api_data = redis.call("GET", api_key)
if not api_data then
    return {false, "API Key not found"}
end

-- Parse JSON (Redis stores strings)
local api_table = cjson.decode(api_data)

-- Only increment usageCount if it's found in Redis
api_table.usageCount = api_table.usageCount + 1

-- Store updated API key in Redis
redis.call("SET", api_key, cjson.encode(api_table))

-- Increment usage count separately for monitoring purposes
local updated_usage = redis.call("INCR", usage_key)

-- Return new usage count
return {true, updated_usage}
