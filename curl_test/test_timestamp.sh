#!/usr/bin/env bash

# 时间戳预测测试
# 测试 POST /timestamp/predict 端点

echo "=== 测试时间戳预测 ==="
echo "URL: http://localhost:8000/timestamp/predict"
echo ""

# 使用示例音频文件
AUDIO_FILE="asr_example.wav"

if [ ! -f "$AUDIO_FILE" ]; then
    echo "警告: 音频文件 $AUDIO_FILE 不存在"
    echo "请准备一个音频文件或修改脚本中的文件路径"
    echo ""
    echo "示例 curl 命令结构:"
    echo "curl -X POST \"http://localhost:8000/timestamp/predict\" \\"
    echo "  -F \"audio_file=@your_audio.wav\" \\"
    echo "  -F \"text_content=这是测试文本\""
    exit 1
fi

curl -X POST "http://localhost:8000/timestamp/predict" \
  -F "audio_file=@$AUDIO_FILE" \
  -F "text_content=这是测试文本用于时间戳预测" \
  | python3 -m json.tool

echo ""
echo "=== 时间戳预测测试完成 ==="