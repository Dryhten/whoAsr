# whoAsr 离线 API 使用指南

本指南介绍如何使用 whoAsr 的离线 API 功能，包括离线语音识别、标点符号添加和时间戳预测。

## 准备工作

### 1. 启动服务
```bash
# 进入项目目录
cd whoAsr

# 安装依赖
uv sync

# 启动服务
uv run python api/main.py
```

### 2. 准备测试音频文件
确保你有一个音频文件用于测试，支持的格式包括：
- WAV
- MP3
- M4A
- FLAC
- OGG

---

## 一、离线语音识别

### 功能说明
将音频文件转换为文本，支持批量处理长音频文件。

### 1. 加载离线识别模型
```bash
curl -X POST http://localhost:8000/model/load \
  -H "Content-Type: application/json" \
  -d '{"model_type": "offline_asr"}'
```

### 2. 识别音频文件
```bash
curl -X POST http://localhost:8000/offline/recognize \
  -F "file=@/path/to/your/audio.wav" \
  -F "batch_size_s=300" \
  -F "batch_size_threshold_s=60"
```

**参数说明：**
- `file`: 音频文件路径（必需）
- `batch_size_s`: 批处理大小（秒），默认 300
- `batch_size_threshold_s`: 批处理阈值（秒），默认 60

**使用热词优化识别：**
```bash
curl -X POST http://localhost:8000/offline/recognize \
  -F "file=@/path/to/your/audio.wav" \
  -F "hotword=人工智能;机器学习;深度学习"
```

**响应示例：**
```json
{
  "success": true,
  "results": [
    {
      "text": "你好，欢迎使用语音识别服务",
      "start": 0,
      "end": 3.5
    },
    {
      "text": "这是一个示例音频",
      "start": 3.8,
      "end": 6.2
    }
  ],
  "message": "Recognition completed",
  "file_name": "audio.wav",
  "file_size": 2048000
}
```

---

## 二、标点符号恢复

### 功能说明
为没有标点符号的中文文本自动添加标点符号。

### 1. 加载标点恢复模型
```bash
curl -X POST http://localhost:8000/model/load \
  -H "Content-Type: application/json" \
  -d '{"model_type": "punctuation"}'
```

### 2. 添加标点符号
```bash
curl -X POST http://localhost:8000/punctuation/add \
  -H "Content-Type: application/json" \
  -d '{"text": "你好世界今天天气不错我们一起出去玩吧"}'
```

**响应示例：**
```json
{
  "original_text": "你好世界今天天气不错我们一起出去玩吧",
  "punctuated_text": "你好，世界！今天天气不错，我们一起出去玩吧。",
  "success": true,
  "message": "Punctuation added successfully"
}
```

**批量处理文本文件示例：**
```bash
# 创建一个包含多个文本的文件
cat > texts.txt << EOF
你好世界今天天气不错
人工智能正在改变我们的生活
语音识别技术越来越成熟
EOF

# 读取文件并逐行处理
while IFS= read -r line; do
  curl -X POST http://localhost:8000/punctuation/add \
    -H "Content-Type: application/json" \
    -d "{\"text\": \"$line\"}"
done < texts.txt
```

---

## 三、时间戳预测

### 功能说明
为音频中的每个词预测精确的时间戳。

### 1. 加载时间戳预测模型
```bash
curl -X POST http://localhost:8000/model/load \
  -H "Content-Type: application/json" \
  -d '{"model_type": "timestamp"}'
```

### 2. 预测时间戳

**方法一：上传文本文件**
```bash
curl -X POST http://localhost:8000/timestamp/predict \
  -F "audio_file=@/path/to/your/audio.wav" \
  -F "text_file=@/path/to/your/transcript.txt"
```

**方法二：直接提供文本内容**
```bash
curl -X POST http://localhost:8000/timestamp/predict \
  -F "audio_file=@/path/to/your/audio.wav" \
  -F "text_content=你好世界，这是一个测试音频"
```

**响应示例：**
```json
{
  "success": true,
  "message": "Timestamp prediction completed",
  "results": [
    {
      "word": "你好",
      "start": 0.5,
      "end": 0.8
    },
    {
      "word": "世界",
      "start": 0.9,
      "end": 1.2
    },
    {
      "word": "，",
      "start": 1.2,
      "end": 1.3
    },
    {
      "word": "这",
      "start": 1.4,
      "end": 1.5
    },
    {
      "word": "是",
      "start": 1.6,
      "end": 1.7
    },
    {
      "word": "一个",
      "start": 1.8,
      "end": 2.0
    },
    {
      "word": "测试",
      "start": 2.1,
      "end": 2.4
    },
    {
      "word": "音频",
      "start": 2.5,
      "end": 2.8
    }
  ]
}
```

---

## 四、完整工作流程示例

### 从音频到带时间戳的标点文本

```bash
#!/bin/bash

# 设置变量
AUDIO_FILE="speech.wav"
OUTPUT_DIR="output"
mkdir -p $OUTPUT_DIR

# 1. 检查服务状态
echo "检查服务状态..."
curl -s http://localhost:8000/health | jq .

# 2. 加载所需模型
echo "加载模型..."
curl -s -X POST http://localhost:8000/model/load \
  -H "Content-Type: application/json" \
  -d '{"model_type": "offline_asr"}' | jq .

curl -s -X POST http://localhost:8000/model/load \
  -H "Content-Type: application/json" \
  -d '{"model_type": "punctuation"}' | jq .

curl -s -X POST http://localhost:8000/model/load \
  -H "Content-Type: application/json" \
  -d '{"model_type": "timestamp"}' | jq .

# 3. 离线语音识别
echo "进行语音识别..."
RECOGNITION_RESULT=$(curl -s -X POST http://localhost:8000/offline/recognize \
  -F "file=@$AUDIO_FILE")

# 提取识别文本
TEXT=$(echo $RECOGNITION_RESULT | jq -r '.results | map(.text) | join("")')
echo "识别文本: $TEXT"

# 4. 添加标点符号
echo "添加标点符号..."
PUNCTUATION_RESULT=$(curl -s -X POST http://localhost:8000/punctuation/add \
  -H "Content-Type: application/json" \
  -d "{\"text\": \"$TEXT\"}")

PUNCTUATED_TEXT=$(echo $PUNCTUATION_RESULT | jq -r '.punctuated_text')
echo "带标点文本: $PUNCTUATED_TEXT"

# 5. 预测时间戳
echo "预测时间戳..."
TIMESTAMP_RESULT=$(curl -s -X POST http://localhost:8000/timestamp/predict \
  -F "audio_file=@$AUDIO_FILE" \
  -F "text_content=$PUNCTUATED_TEXT")

# 6. 保存结果
echo $RECOGNITION_RESULT | jq . > $OUTPUT_DIR/recognition.json
echo $PUNCTUATION_RESULT | jq . > $OUTPUT_DIR/punctuation.json
echo $TIMESTAMP_RESULT | jq . > $OUTPUT_DIR/timestamp.json
echo $PUNCTUATED_TEXT > $OUTPUT_DIR/final_text.txt

echo "处理完成！结果保存在 $OUTPUT_DIR 目录"
```

---

## 五、批量处理脚本

### 批量处理音频文件夹

```bash
#!/bin/bash

# 设置参数
AUDIO_DIR="./audio_files"
OUTPUT_DIR="./batch_output"
LOG_FILE="./batch_process.log"

# 创建输出目录
mkdir -p $OUTPUT_DIR

# 日志函数
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a $LOG_FILE
}

# 确保模型已加载
log "检查并加载所需模型..."
curl -s -X POST http://localhost:8000/model/load \
  -H "Content-Type: application/json" \
  -d '{"model_type": "offline_asr"}' > /dev/null

curl -s -X POST http://localhost:8000/model/load \
  -H "Content-Type: application/json" \
  -d '{"model_type": "punctuation"}' > /dev/null

# 处理每个音频文件
for audio_file in $AUDIO_DIR/*.{wav,mp3,m4a,flac,ogg}; do
    if [ -f "$audio_file" ]; then
        filename=$(basename "$audio_file")
        name="${filename%.*}"
        log "处理文件: $filename"

        # 语音识别
        recognition=$(curl -s -X POST http://localhost:8000/offline/recognize \
            -F "file=@$audio_file")

        if echo $recognition | jq -e '.success' > /dev/null; then
            # 提取文本
            text=$(echo $recognition | jq -r '.results | map(.text) | join("")')

            # 添加标点
            punctuation=$(curl -s -X POST http://localhost:8000/punctuation/add \
                -H "Content-Type: application/json" \
                -d "{\"text\": \"$text\"}")

            # 保存结果
            final_text=$(echo $punctuation | jq -r '.punctuated_text')
            echo $final_text > "$OUTPUT_DIR/${name}_result.txt"

            # 保存详细结果
            echo $recognition | jq . > "$OUTPUT_DIR/${name}_recognition.json"
            echo $punctuation | jq . > "$OUTPUT_DIR/${name}_punctuation.json"

            log "✓ $filename 处理成功"
        else
            log "✗ $filename 处理失败: $(echo $recognition | jq -r '.detail')"
        fi
    fi
done

log "批量处理完成！"
```

---

## 六、常见问题

### 1. 模型未加载错误
**错误信息：** `Model not loaded`

**解决方法：**
```bash
# 检查模型状态
curl http://localhost:8000/model/info | jq .

# 加载所需模型
curl -X POST http://localhost:8000/model/load \
  -H "Content-Type: application/json" \
  -d '{"model_type": "offline_asr"}'
```

### 2. 音频格式不支持
**错误信息：** `Unsupported file format`

**解决方法：** 使用支持的音频格式（WAV, MP3, M4A, FLAC, OGG）

### 3. 文件路径问题
**确保使用正确的文件路径：**
- Linux/Mac: `/home/user/audio.wav` 或 `./audio.wav`
- Windows: `C:\Users\User\audio.wav` 或 `audio.wav`

### 4. 响应数据提取
使用 `jq` 工具提取 JSON 数据：
```bash
# 安装 jq
# Ubuntu/Debian: sudo apt-get install jq
# Mac: brew install jq

# 提取识别文本
curl ... | jq -r '.results | map(.text) | join("")'

# 提取带标点文本
curl ... | jq -r '.punctuated_text'

# 提取时间戳
curl ... | jq -r '.results[] | "\(.word) [\(.start)-\(.end)]"'
```

---

## 七、性能优化建议

1. **批量处理：** 对于大量文件，编写脚本批量处理
2. **并行请求：** 使用 `xargs` 或 `parallel` 工具并行处理多个文件
3. **模型预热：** 首次加载模型较慢，建议保持服务运行
4. **文件大小：** 大文件建议分段处理，设置合适的 `batch_size_s`

---

## 八、快速测试脚本

```bash
#!/bin/bash

# 一键测试所有离线 API 功能
echo "=== whoAsr 离线 API 测试 ==="

# 1. 测试标点符号恢复
echo -e "\n1. 测试标点符号恢复..."
curl -s -X POST http://localhost:8000/punctuation/add \
  -H "Content-Type: application/json" \
  -d '{"text": "今天天气很好我们一起去公园散步吧"}' | jq .

# 2. 如果有音频文件，测试语音识别
if [ -f "test_audio.wav" ]; then
    echo -e "\n2. 测试离线语音识别..."
    curl -s -X POST http://localhost:8000/offline/recognize \
      -F "file=@test_audio.wav" | jq .
fi

# 3. 查看模型状态
echo -e "\n3. 查看模型状态..."
curl -s http://localhost:8000/model/info | jq '.models'

echo -e "\n测试完成！"
```

保存上述脚本为 `test_offline_api.sh`，运行 `chmod +x test_offline_api.sh` 后即可使用。