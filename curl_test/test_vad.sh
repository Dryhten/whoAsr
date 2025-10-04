#!/usr/bin/env bash

# 语音活动检测测试
# 测试 POST /vad/detect 端点

echo "=== 测试语音活动检测 ==="
echo "URL: http://localhost:8000/vad/detect"
echo ""

# 使用示例音频文件
AUDIO_FILE="asr_example.wav"

if [ ! -f "$AUDIO_FILE" ]; then
    echo "警告: 音频文件 $AUDIO_FILE 不存在"
    echo "请准备一个音频文件或修改脚本中的文件路径"
    echo ""
    echo "示例 curl 命令结构:"
    echo "curl -X POST \"http://localhost:8000/vad/detect\" \\"
    echo "  -F \"file=@your_audio.wav\""
    exit 1
fi

curl -X POST "http://localhost:8000/vad/detect" \
  -F "file=@$AUDIO_FILE" \
  | python3 -m json.tool

echo ""
echo "=== 语音活动检测测试完成 ==="