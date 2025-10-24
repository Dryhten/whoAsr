# whoAsr Frontend

基于 Preact + TypeScript + Vite 构建的实时语音识别前端应用。

## 快速开始

### 开发模式

```bash
npm run dev
```

启动开发服务器，访问 http://localhost:5173/

**注意**: 开发模式下需要确保后端服务已启动（默认 http://localhost:8000）

### 生产构建

```bash
npm run build
```

构建生产版本，输出到 `dist/` 目录

### 预览生产构建

```bash
npm run preview
```

在 http://localhost:4173/ 预览生产构建

## 后端集成

### 模型自动加载

后端服务启动时会**默认自动加载实时语音识别模型**（`streaming_asr`），因此：

- ✅ 启动后可以**立即使用**实时录音识别功能
- ✅ 无需在前端手动触发模型加载
- ✅ 首次使用时响应更快

如果需要使用其他功能（离线识别、标点添加等），可以：

1. 在模型管理页面手动加载相应模型
2. 或配置后端环境变量 `PRELOAD_MODELS` 预加载多个模型

详见后端文档: `../docs/MODEL_AUTO_LOADING.md`

## 项目结构

```
frontend/
├── src/
│   ├── api.ts              # API 客户端
│   ├── components/         # 可复用组件
│   ├── pages/             # 页面组件
│   ├── lib/               # 工具函数
│   └── hooks/             # 自定义 Hooks
├── public/                # 静态资源
└── dist/                  # 构建输出（生产环境由后端托管）
```
