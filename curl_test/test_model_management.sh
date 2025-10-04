#!/usr/bin/env bash

# 模型管理测试脚本
# 测试所有模型管理相关端点

echo "=== 模型管理测试 ==="

# 1. 查看模型状态
echo "1. 查看模型状态 (GET /model/info)"
echo "URL: http://localhost:8000/model/info"
echo ""

curl -X GET "http://localhost:8000/model/info" \
  -H "Content-Type: application/json" \
  | python3 -m json.tool

echo ""
echo "=================================="
echo ""

# 2. 加载标点模型
echo "2. 加载标点模型 (POST /model/load)"
echo "URL: http://localhost:8000/model/load"
echo ""

curl -X POST "http://localhost:8000/model/load" \
  -H "Content-Type: application/json" \
  -d '{
    "model_type": "punctuation"
  }' \
  | python3 -m json.tool

echo ""
echo "=================================="
echo ""

# 3. 获取模型配置
echo "3. 获取标点模型配置 (GET /model/config/punctuation)"
echo "URL: http://localhost:8000/model/config/punctuation"
echo ""

curl -X GET "http://localhost:8000/model/config/punctuation" \
  -H "Content-Type: application/json" \
  | python3 -m json.tool

echo ""
echo "=================================="
echo ""

# 4. 卸载标点模型
echo "4. 卸载标点模型 (POST /model/unload/punctuation)"
echo "URL: http://localhost:8000/model/unload/punctuation"
echo ""

curl -X POST "http://localhost:8000/model/unload/punctuation" \
  -H "Content-Type: application/json" \
  | python3 -m json.tool

echo ""
echo "=== 模型管理测试完成 ==="
echo ""
echo "注意: 可以将 model_type 替换为以下值测试其他模型:"
echo "  - streaming_asr (实时语音识别)"
echo "  - offline_asr (离线语音识别)"
echo "  - vad (语音活动检测)"
echo "  - timestamp (时间戳预测)"
echo "  - punctuation (标点恢复)"