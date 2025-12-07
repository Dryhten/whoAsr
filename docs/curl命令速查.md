# whoAsr curl 命令速查

## 一、离线语音识别

### 1. 加载模型
```bash
curl -X POST http://localhost:8000/model/load \
  -H "Content-Type: application/json" \
  -d '{"model_type": "offline_asr"}'
```

### 2. 识别音频文件
```bash
curl -X POST http://localhost:8000/offline/recognize \
  -F "file=@audio.wav"
```

### 3. 识别音频文件（带热词）
```bash
curl -X POST http://localhost:8000/offline/recognize \
  -F "file=@audio.wav" \
  -F "hotword=人工智能;机器学习"
```

---

## 二、标点符号添加

### 1. 加载模型
```bash
curl -X POST http://localhost:8000/model/load \
  -H "Content-Type: application/json" \
  -d '{"model_type": "punctuation"}'
```

### 2. 添加标点
```bash
curl -X POST http://localhost:8000/punctuation/add \
  -H "Content-Type: application/json" \
  -d '{"text": "你好世界今天天气不错"}'
```

---

## 三、时间戳预测

### 1. 加载模型
```bash
curl -X POST http://localhost:8000/model/load \
  -H "Content-Type: application/json" \
  -d '{"model_type": "timestamp"}'
```

### 2. 上传文本文件预测
```bash
curl -X POST http://localhost:8000/timestamp/predict \
  -F "audio_file=@audio.wav" \
  -F "text_file=@transcript.txt"
```

### 3. 直接输入文本预测
```bash
curl -X POST http://localhost:8000/timestamp/predict \
  -F "audio_file=@audio.wav" \
  -F "text_content=你好世界，这是一个测试音频"
```

---

## 四、语音活动检测（VAD）

### 1. 加载模型
```bash
curl -X POST http://localhost:8000/model/load \
  -H "Content-Type: application/json" \
  -d '{"model_type": "vad"}'
```

### 2. 检测语音活动
```bash
curl -X POST http://localhost:8000/vad/detect \
  -F "file=@audio.wav"
```

---

## 五、查看状态

### 1. 查看服务健康状态
```bash
curl http://localhost:8000/health
```

### 2. 查看所有模型状态
```bash
curl http://localhost:8000/model/info
```

---

## 六、模型管理

### 1. 卸载模型
```bash
curl -X POST http://localhost:8000/model/unload/offline_asr
curl -X POST http://localhost:8000/model/unload/punctuation
curl -X POST http://localhost:8000/model/unload/timestamp
curl -X POST http://localhost:8000/model/unload/vad
```

### 2. 查看特定模型配置
```bash
curl http://localhost:8000/model/config/offline_asr
curl http://localhost:8000/model/config/punctuation
curl http://localhost:8000/model/config/timestamp
curl http://localhost:8000/model/config/vad
```

---

## 注意事项

1. 音频文件路径前需要加 `@` 符号
2. 支持的音频格式：WAV, MP3, M4A, FLAC, OGG
3. 使用前确保对应的模型已加载
4. 服务默认运行在 `http://localhost:8000`