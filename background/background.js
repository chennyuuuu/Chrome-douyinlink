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
// 从Chrome存储中读取飞书配置
let feishuConfig = null;

// 加载飞书配置
async function loadFeishuConfig() {
  try {
    const config = await chrome.storage.sync.get([
      'feishuAppId',
      'feishuAppSecret',
      'feishuBaseUrl',
      'feishuAppToken',
      'feishuTableId'
    ]);

    // 验证配置完整性
    if (!config.feishuAppId || !config.feishuAppSecret || !config.feishuAppToken || !config.feishuTableId) {
      throw new Error('飞书配置不完整，请先完成配置');
    }

    feishuConfig = {
      appId: config.feishuAppId,
      appSecret: config.feishuAppSecret,
      baseUrl: config.feishuBaseUrl || 'https://open.feishu.cn/open-apis',
      tableConfig: {
        appToken: config.feishuAppToken,
        tableId: config.feishuTableId
      }
    };
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
        'Content-Type': 'application/json'
      },
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
async function writeToFeishuTable(contents) {
  if (!feishuConfig) {
    await loadFeishuConfig();
  }

  try {
    const token = await getFeiShuToken();
    const response = await fetch(`${feishuConfig.baseUrl}/bitable/v1/apps/${feishuConfig.tableConfig.appToken}/tables/${feishuConfig.tableConfig.tableId}/records/batch_create`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        records: contents.map(content => ({
          fields: {
            '链接': {
              text: content.title || (content.type === 'video' ? '抖音视频' : '抖音图文'),
              link: content.url
            },
            '点赞数': parseInt(content.likes) || 0,
            '评论数': parseInt(content.comments) || 0,
            '类型': content.type === 'video' ? '视频' : '图文',
            '发布时间': content.publishTime || ''
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
loadFeishuConfig().catch(error => {
  console.warn('初始化飞书配置失败:', error.message);
});