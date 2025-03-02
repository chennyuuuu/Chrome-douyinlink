// 监听来自content script的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'downloadLinks') {
    // 创建文本内容
    const content = request.links.join('\n');
    
    // 创建Blob对象
    const blob = new Blob([content], { type: 'text/plain' });
    
    // 使用chrome.downloads API下载文件
    chrome.downloads.download({
      url: URL.createObjectURL(blob),
      filename: '抖音视频链接.txt',
      saveAs: true
    });
    
    sendResponse({ status: 'success' });
  }
  return true; // 保持消息通道开放
});

// 从配置文件中读取飞书应用凭据
let feishuConfig = null;

// 加载飞书配置
async function loadFeishuConfig() {
  try {
    const response = await fetch(chrome.runtime.getURL('config/feishu.json'));
    feishuConfig = await response.json();
  } catch (error) {
    console.error('加载飞书配置失败:', error);
    throw error;
  }
}

// 获取飞书访问令牌
async function getFeiShuToken() {
  if (!feishuConfig) {
    await loadFeishuConfig();
  }

  try {
    const response = await fetch(`${feishuConfig.baseUrl}/auth/v3/tenant_access_token/internal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      mode: 'cors',
      body: JSON.stringify({
        'app_id': feishuConfig.appId,
        'app_secret': feishuConfig.appSecret
      })
    });

    const data = await response.json();
    if (data.code === 0) {
      return data.tenant_access_token;
    } else {
      throw new Error(`获取飞书令牌失败: ${data.msg}`);
    }
  } catch (error) {
    console.error('获取飞书令牌出错:', error);
    throw error;
  }
}

// 写入数据到飞书多维表格
async function writeToFeishuTable(videos) {
  if (!feishuConfig) {
    await loadFeishuConfig();
  }

  try {
    const token = await getFeiShuToken();
    const response = await fetch(`${feishuConfig.baseUrl}/bitable/v1/apps/${feishuConfig.tableConfig.appToken}/tables/${feishuConfig.tableConfig.tableId}/records/batch_create`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      },
      mode: 'cors',
      body: JSON.stringify({
        records: videos.map(video => ({
          fields: {
            '链接': {
              text: video.title || '抖音视频',
              link: video.url
            }
          }
        }))
      })
    });

    const data = await response.json();
    if (data.code === 0) {
      return { success: true, message: '数据写入成功' };
    } else {
      throw new Error(`写入数据失败: ${data.msg}`);
    }
  } catch (error) {
    console.error('写入飞书表格出错:', error);
    throw error;
  }
}

// 监听来自popup的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'writeToFeishu') {
    writeToFeishuTable(request.links)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, message: error.message }));
    return true; // 保持消息通道开启
  }
});

// 初始化时加载配置
loadFeishuConfig();