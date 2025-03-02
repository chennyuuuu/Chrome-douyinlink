// 获取DOM元素
const likeThresholdInput = document.getElementById('likeThreshold');
const startBtn = document.getElementById('startBtn');
const exportBtn = document.getElementById('exportBtn');
const feishuBtn = document.getElementById('feishuBtn');
const statusDiv = document.getElementById('status');

// 存储提取到的视频链接
let videoLinks = [];

// 开始提取按钮点击事件
startBtn.addEventListener('click', async () => {
  // 禁用按钮，避免重复操作
  startBtn.disabled = true;
  exportBtn.disabled = true;
  feishuBtn.disabled = true;
  statusDiv.textContent = '正在提取视频链接...';
  
  try {
    // 获取当前标签页
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // 检查是否在抖音页面
    if (!tab.url.includes('douyin.com')) {
      throw new Error('请在抖音博主主页使用此扩展');
    }
    
    // 获取点赞数阈值
    const threshold = parseInt(likeThresholdInput.value) || 0;
    
    // 向content script发送消息，开始提取
    const response = await chrome.tabs.sendMessage(tab.id, {
      action: 'startExtract',
      threshold: threshold
    });
    
    if (response.success) {
      videoLinks = response.links;
      statusDiv.textContent = `成功提取 ${videoLinks.length} 个视频链接`;
      exportBtn.disabled = false;
      feishuBtn.disabled = false;
    } else {
      throw new Error(response.error || '提取失败');
    }
  } catch (error) {
    statusDiv.textContent = error.message;
  } finally {
    startBtn.disabled = false;
  }
});

// 导出按钮点击事件
exportBtn.addEventListener('click', () => {
  if (videoLinks.length === 0) {
    statusDiv.textContent = '没有可导出的视频链接';
    return;
  }
  
  // 创建文本内容
  const content = videoLinks.join('\n');
  const blob = new Blob([content], { type: 'text/plain' });
  
  // 生成文件名
  const date = new Date().toISOString().slice(0, 10);
  const filename = `douyin_videos_${date}.txt`;
  
  // 下载文件
  chrome.downloads.download({
    url: URL.createObjectURL(blob),
    filename: filename,
    saveAs: true
  });
  
  statusDiv.textContent = '导出完成';
});

// 飞书按钮点击事件
feishuBtn.addEventListener('click', async () => {
  if (videoLinks.length === 0) {
    statusDiv.textContent = '没有可写入的视频链接';
    return;
  }

  feishuBtn.disabled = true;
  statusDiv.textContent = '正在写入飞书多维表格...';

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'writeToFeishu',
      links: videoLinks
    });

    if (response.success) {
      statusDiv.textContent = '成功写入飞书多维表格';
    } else {
      throw new Error(response.message || '写入失败');
    }
  } catch (error) {
    statusDiv.textContent = `写入失败: ${error.message}`;
  } finally {
    feishuBtn.disabled = false;
  }
});