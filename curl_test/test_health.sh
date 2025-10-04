#!/usr/bin/env bash

# 健康检查测试
# 测试 GET /health 端点

echo "=== 测试健康检查端点 ==="
echo "URL: http://localhost:8000/health"
echo ""

curl -X GET "http://localhost:8000/health" \
  -H "Content-Type: application/json" \
  | python3 -m json.tool

echo ""
echo "=== 健康检查测试完成 ==="