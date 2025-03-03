// 获取DOM元素
const likeThresholdInput = document.getElementById('likeThreshold');
const startBtn = document.getElementById('startBtn');
const exportBtn = document.getElementById('exportBtn');
const feishuBtn = document.getElementById('feishuBtn');
const statusDiv = document.getElementById('status');
const configStatusDiv = document.getElementById('configStatus');
const configBtn = document.getElementById('configBtn');

// 存储提取到的作品数据
let contentData = [];

// 检查飞书配置状态
async function checkFeishuConfig() {
  try {
    const config = await chrome.storage.sync.get([
      'feishuAppId',
      'feishuAppSecret',
      'feishuAppToken',
      'feishuTableId'
    ]);
    
    // 验证配置完整性
    if (!config.feishuAppId || !config.feishuAppSecret || !config.feishuAppToken || !config.feishuTableId) {
      // 配置不完整，显示警告
      configStatusDiv.textContent = '飞书配置不完整，写入飞书功能将不可用';
      configStatusDiv.className = 'config-status warning';
      configBtn.classList.remove('hidden');
      feishuBtn.disabled = true;
      return false;
    } else {
      // 配置完整，显示成功信息
      configStatusDiv.textContent = '飞书配置已完成';
      configStatusDiv.className = 'config-status success';
      // 保持配置按钮始终可见
      configStatusDiv.classList.remove('hidden');
      return true;
    }
  } catch (error) {
    // 出现错误，显示错误信息
    configStatusDiv.textContent = `配置检查失败: ${error.message}`;
    configStatusDiv.className = 'config-status error';
    configBtn.classList.remove('hidden');
    feishuBtn.disabled = true;
    return false;
  }
}

// 开始提取按钮点击事件
startBtn.addEventListener('click', async () => {
  // 禁用按钮，避免重复操作
  startBtn.disabled = true;
  exportBtn.disabled = true;
  feishuBtn.disabled = true;
  statusDiv.textContent = '正在提取作品数据...';
  
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
      contentData = response.links;
      
      // 统计视频和图文数量
      const videoCount = contentData.filter(item => item.type === 'video').length;
      const noteCount = contentData.filter(item => item.type === 'note').length;
      
      // 更新状态显示
      if (noteCount > 0) {
        statusDiv.textContent = `成功提取 ${contentData.length} 个作品（${videoCount} 个视频，${noteCount} 个图文）`;
      } else {
        statusDiv.textContent = `成功提取 ${contentData.length} 个视频作品`;
      }
      
      exportBtn.disabled = false;
      
      // 根据飞书配置状态决定是否启用飞书按钮
      const configValid = await checkFeishuConfig();
      feishuBtn.disabled = !configValid || contentData.length === 0;
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
  if (contentData.length === 0) {
    statusDiv.textContent = '没有可导出的作品数据';
    return;
  }
  
  // 创建文本内容
  let content = '';
  
  // 检查是否有图文作品
  const hasNotes = contentData.some(item => item.type === 'note');
  
  if (hasNotes) {
    // 如果包含图文作品，使用更详细的格式
    contentData.forEach(item => {
      content += `【${item.type === 'video' ? '视频' : '图文'}】${item.title}\n`;
      content += `链接：${item.url}\n`;
      content += `点赞：${item.likes}，评论：${item.comments || 0}\n`;
      if (item.publishTime) content += `发布时间：${item.publishTime}\n`;
      content += '\n';
    });
  } else {
    // 如果只有视频，使用简单的链接列表
    content = contentData.map(item => item.url).join('\n');
  }
  
  const blob = new Blob([content], { type: 'text/plain' });
  
  // 生成文件名
  const date = new Date().toISOString().slice(0, 10);
  const filename = hasNotes ? `douyin_contents_${date}.txt` : `douyin_videos_${date}.txt`;
  
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
  if (contentData.length === 0) {
    statusDiv.textContent = '没有可写入的作品数据';
    return;
  }

  feishuBtn.disabled = true;
  statusDiv.textContent = '正在写入飞书多维表格...';

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'writeToFeishu',
      links: contentData
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

// 配置按钮点击事件
configBtn.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

// 页面加载时检查配置状态
document.addEventListener('DOMContentLoaded', () => {
  checkFeishuConfig();
});