-- 性能优化：新增 Spool 排序与复合索引
-- 解决 GET /api/spools 列表按 created_at 排序时走全表扫描的问题

-- Spool 按创建时间排序的索引（列表页默认排序）
CREATE INDEX "Spool_created_at_idx" ON "Spool"("created_at");

-- Spool 状态 + 创建时间复合索引（状态过滤 + 排序同时受益）
CREATE INDEX "Spool_status_created_at_idx" ON "Spool"("status", "created_at");
