# 抖音视频链接提取器 Chrome扩展

## 功能介绍

这是一个用于提取抖音博主主页视频链接的Chrome浏览器扩展。主要功能包括：

1. 自动滚动页面：自动滚动到页面底部，确保获取所有视频内容
2. 点赞数筛选：支持设置最低点赞数阈值，只提取点赞数超过设定值的视频
3. 导出功能：将筛选后的视频链接导出为文本文件
4. 美观界面：简洁直观的用户界面，提供良好的用户体验

## 使用方法

1. 安装扩展后，在抖音博主的主页点击扩展图标
2. 在弹出的界面中设置最低点赞数（可选）
3. 点击"开始提取"按钮，扩展会自动滚动页面并收集视频链接
4. 完成后点击"导出"按钮，将链接保存为文本文件

## 技术实现

- 使用Chrome Extension Manifest V3规范开发
- 采用Service Worker作为后台脚本
- 使用Content Script实现页面交互和数据提取
- 遵循Chrome安全策略和最佳实践

## 项目结构

```
├── manifest.json        # 扩展配置文件
├── popup/              # 弹出窗口相关文件
├── content/            # 内容脚本
├── background/         # Service Worker
└── images/            # 图标等资源文件
```

## 注意事项

- 请遵守抖音平台的使用规则
- 建议合理设置点赞数阈值，避免获取过多无用数据
- 自动滚动过程中请勿手动操作页面

## 版本更新记录

### v1.0.0
- 初始版本发布
- 实现自动滚动页面获取视频链接
- 支持点赞数阈值筛选
- 支持导出视频链接为文本文件
- 支持将视频链接写入飞书多维表格
- 提供简洁美观的用户界面

## 飞书配置说明

在使用飞书多维表格功能前，需要修改配置文件：

1. 打开 `config/feishu.json` 文件
2. 修改以下配置项：
   - `appId`：替换为你的飞书应用 App ID
   - `appSecret`：替换为你的飞书应用 App Secret
   - `tableConfig.appToken`：替换为你的多维表格 app_token
   - `tableConfig.tableId`：替换为你的多维表格 table_id

获取这些参数的方法：
1. 在[飞书开发者后台](https://open.feishu.cn/app)创建应用，获取 App ID 和 App Secret
2. 在多维表格URL中获取 app_token 和 table_id，URL格式如：
   `https://xxx.feishu.cn/base/[app_token]?table=[table_id]`