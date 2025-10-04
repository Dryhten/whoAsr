#!/usr/bin/env bash

# 运行所有 curl 测试的脚本

echo "======================================"
echo "whoAsr API 完整测试套件"
echo "======================================"
echo ""

# 检查服务是否运行
echo "检查服务状态..."
if ! curl -s "http://localhost:8000/health" > /dev/null; then
    echo "❌ 错误: whoAsr 服务未运行或无法访问"
    echo "请先启动服务: uv run python -m api.main"
    exit 1
fi

echo "✅ 服务正在运行"
echo ""

# 运行不需要音频文件的测试
echo "======================================"
echo "1. 健康检查测试"
echo "======================================"
./test_health.sh
echo ""

echo "======================================"
echo "2. 模型管理测试"
echo "======================================"
./test_model_management.sh
echo ""

echo "======================================"
echo "3. 文本标点恢复测试"
echo "======================================"
./test_punctuation.sh
echo ""

# 检查音频文件是否存在
AUDIO_FILE="asr_example.wav"
AUDIO_EXISTS=false

if [ -f "$AUDIO_FILE" ]; then
    AUDIO_EXISTS=true
    echo "✅ 找到音频文件: $AUDIO_FILE"
else
    echo "⚠️  警告: 未找到音频文件 $AUDIO_FILE"
    echo "跳过需要音频文件的测试"
    echo ""
    echo "如需运行完整测试，请准备音频文件并重新运行"
fi

# 如果音频文件存在，运行音频相关测试
if [ "$AUDIO_EXISTS" = true ]; then
    echo ""
    echo "======================================"
    echo "4. 离线语音识别测试"
    echo "======================================"
    ./test_offline_asr.sh
    echo ""

    echo "======================================"
    echo "5. 语音活动检测测试"
    echo "======================================"
    ./test_vad.sh
    echo ""

    echo "======================================"
    echo "6. 时间戳预测测试"
    echo "======================================"
    ./test_timestamp.sh
fi

echo ""
echo "======================================"
echo "✅ 测试完成"
echo "======================================"
echo ""
echo "测试总结:"
echo "- 健康检查: 完成"
echo "- 模型管理: 完成"
echo "- 文本标点恢复: 完成"
if [ "$AUDIO_EXISTS" = true ]; then
    echo "- 离线语音识别: 完成"
    echo "- 语音活动检测: 完成"
    echo "- 时间戳预测: 完成"
else
    echo "- 离线语音识别: 跳过 (无音频文件)"
    echo "- 语音活动检测: 跳过 (无音频文件)"
    echo "- 时间戳预测: 跳过 (无音频文件)"
fi
echo ""
echo "WebSocket 测试请使用专门的 WebSocket 客户端工具"