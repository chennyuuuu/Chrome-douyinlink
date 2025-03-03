// 获取DOM元素
const appIdInput = document.getElementById('appId');
const appSecretInput = document.getElementById('appSecret');
const baseUrlInput = document.getElementById('baseUrl');
const appTokenInput = document.getElementById('appToken');
const tableIdInput = document.getElementById('tableId');
const saveBtn = document.getElementById('saveBtn');
const testBtn = document.getElementById('testBtn');
const statusMessage = document.getElementById('statusMessage');

// 从Chrome存储中加载配置
async function loadConfig() {
  try {
    const config = await chrome.storage.sync.get([
      'feishuAppId',
      'feishuAppSecret',
      'feishuBaseUrl',
      'feishuAppToken',
      'feishuTableId'
    ]);
    
    appIdInput.value = config.feishuAppId || '';
    appSecretInput.value = config.feishuAppSecret || '';
    baseUrlInput.value = config.feishuBaseUrl || 'https://open.feishu.cn/open-apis';
    appTokenInput.value = config.feishuAppToken || '';
    tableIdInput.value = config.feishuTableId || '';
  } catch (error) {
    showStatus('加载配置失败：' + error.message, false);
  }
}

// 保存配置到Chrome存储
async function saveConfig() {
  try {
    const config = {
      feishuAppId: appIdInput.value.trim(),
      feishuAppSecret: appSecretInput.value.trim(),
      feishuBaseUrl: baseUrlInput.value.trim(),
      feishuAppToken: appTokenInput.value.trim(),
      feishuTableId: tableIdInput.value.trim()
    };
    
    // 验证必填字段
    if (!config.feishuAppId || !config.feishuAppSecret || !config.feishuAppToken || !config.feishuTableId) {
      throw new Error('请填写所有必填字段');
    }
    
    await chrome.storage.sync.set(config);
    showStatus('配置保存成功！', true);
  } catch (error) {
    showStatus('保存配置失败：' + error.message, false);
  }
}

// 测试飞书连接
async function testConnection() {
  try {
    const config = {
      appId: appIdInput.value.trim(),
      appSecret: appIdInput.value.trim(),
      baseUrl: baseUrlInput.value.trim(),
      appToken: appTokenInput.value.trim(),
      tableId: tableIdInput.value.trim()
    };
    
    // 验证必填字段
    if (!config.appId || !config.appSecret || !config.appToken || !config.tableId) {
      throw new Error('请先填写完整的配置信息');
    }
    
    showStatus('正在测试连接...', null);
    testBtn.disabled = true;
    
    // 获取访问令牌
    const tokenResponse = await fetch(`${config.baseUrl}/auth/v3/tenant_access_token/internal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        'app_id': config.appId,
        'app_secret': config.appSecret
      })
    });
    
    const tokenData = await tokenResponse.json();
    if (tokenData.code !== 0) {
      throw new Error(`获取访问令牌失败：${tokenData.msg}`);
    }
    
    // 测试表格访问
    const tableResponse = await fetch(
      `${config.baseUrl}/bitable/v1/apps/${config.appToken}/tables/${config.tableId}`,
      {
        headers: {
          'Authorization': `Bearer ${tokenData.tenant_access_token}`
        }
      }
    );
    
    const tableData = await tableResponse.json();
    if (tableData.code !== 0) {
      throw new Error(`访问多维表格失败：${tableData.msg}`);
    }
    
    // 写入测试数据到飞书多维表格
    showStatus('正在写入测试数据...', null);
    
    // 创建测试数据
    const testData = {
      records: [{
        fields: {
          '链接': {
            text: '测试',
            link: 'https://www.bilibili.com/'
          },
          '点赞数': 10000
        }
      }]
    };
    
    // 写入测试数据
    const writeResponse = await fetch(
      `${config.baseUrl}/bitable/v1/apps/${config.appToken}/tables/${config.tableId}/records/batch_create`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenData.tenant_access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testData)
      }
    );
    
    const writeData = await writeResponse.json();
    if (writeData.code !== 0) {
      throw new Error(`写入测试数据失败：${writeData.msg}`);
    }
    
    showStatus('连接测试成功！测试数据已写入飞书多维表格。', true);
  } catch (error) {
    showStatus('连接测试失败：' + error.message, false);
  } finally {
    testBtn.disabled = false;
  }
}

// 显示状态信息
function showStatus(message, success) {
  statusMessage.textContent = message;
  statusMessage.className = 'status ' + (success === null ? '' : success ? 'success' : 'error');
  statusMessage.classList.remove('hidden');
}

// 绑定事件监听器
saveBtn.addEventListener('click', saveConfig);
testBtn.addEventListener('click', testConnection);

// 页面加载时读取配置
document.addEventListener('DOMContentLoaded', loadConfig);