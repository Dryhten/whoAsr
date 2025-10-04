#!/usr/bin/env bash

# 文本标点恢复测试
# 测试 POST /punctuation/add 端点

echo "=== 测试文本标点恢复 ==="
echo "URL: http://localhost:8000/punctuation/add"
echo ""

curl -X POST "http://localhost:8000/punctuation/add" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "你好世界我是测试文本请帮我添加标点符号"
  }' \
  | python3 -m json.tool

echo ""
echo "=== 文本标点恢复测试完成 ==="