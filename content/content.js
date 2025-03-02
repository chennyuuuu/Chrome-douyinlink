// 监听来自popup的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'startExtract') {
    extractVideoLinks(request.threshold)
      .then(links => sendResponse({ success: true, links }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // 保持消息通道开启
  }
});

// 提取视频链接的主要函数
async function extractVideoLinks(likeThreshold) {
  const videos = [];
  let isScrolling = true;
  let lastHeight = document.documentElement.scrollHeight;
  let noChangeCount = 0;
  let scrollAttempts = 0;
  const maxScrollAttempts = 20; // 最大滚动尝试次数
  
  console.log('开始提取视频链接...');
  
  // 滚动到页面底部
  while (isScrolling && scrollAttempts < maxScrollAttempts) {
    window.scrollTo(0, document.documentElement.scrollHeight);
    await new Promise(resolve => setTimeout(resolve, 3000)); // 增加等待时间到3秒
    
    // 检查是否到达底部
    const newHeight = document.documentElement.scrollHeight;
    if (newHeight === lastHeight) {
      noChangeCount++;
      console.log(`页面高度未变化，计数：${noChangeCount}`);
      // 连续3次高度没有变化才认为到达底部
      if (noChangeCount >= 3) {
        isScrolling = false;
        console.log('已到达页面底部');
      }
    } else {
      noChangeCount = 0;
      console.log('页面继续加载中...');
    }
    lastHeight = newHeight;
    scrollAttempts++;
    console.log(`滚动尝试次数：${scrollAttempts}/${maxScrollAttempts}`);
  }
  
  // 获取所有视频元素（使用多个选择器以适应不同布局）
  const videoSelectors = [
    'a[href^="/video/"]',
    '.xgplayer-video-item a',
    '.author-card-user-video a'
  ];
  
  const videoElements = document.querySelectorAll(videoSelectors.join(', '));
  console.log(`找到 ${videoElements.length} 个视频元素`);
  
  // 遍历视频元素，提取链接、标题和点赞数
  for (const element of videoElements) {
    try {
      // 获取点赞数（支持多种选择器）
      const likeSelectors = [
        '.author-card-user-video-like .BgCg_ebQ',
        '.author-card-user-video-like .video-count',
        '.like-count',
        '[data-e2e="like-count"]'
      ];
      
      let likeElement = null;
      for (const selector of likeSelectors) {
        likeElement = element.querySelector(selector);
        if (likeElement) break;
      }
      
      if (!likeElement) {
        console.log('未找到点赞数元素，尝试查找父元素...');
        // 尝试在父元素中查找
        for (const selector of likeSelectors) {
          likeElement = element.closest('div')?.querySelector(selector);
          if (likeElement) break;
        }
      }
      
      if (!likeElement) {
        console.log('未找到点赞数元素，跳过');
        continue;
      }
      
      const likeText = likeElement.textContent.trim();
      console.log(`原始点赞文本：${likeText}`);
      
      // 处理可能的单位（万、w等）
      let likeCount = 0;
      if (likeText.includes('万') || likeText.toLowerCase().includes('w')) {
        const num = parseFloat(likeText.replace(/[^0-9.]/g, ''));
        likeCount = Math.floor(num * 10000);
      } else {
        likeCount = parseInt(likeText.replace(/[^0-9]/g, ''));
      }
      
      console.log(`解析后的点赞数：${likeCount}`);
      
      // 获取评论数（支持多种选择器）
      const commentSelectors = [
        '.comment-count',
        '[data-e2e="comment-count"]',
        '.author-card-user-video-comment .video-count',
        '.author-card-user-video-comment .BgCg_ebQ',
        // 新增更多可能的评论数选择器
        '.semi-icon-comment + .BgCg_ebQ',
        '.semi-icon-comment + span',
        '[class*="comment"] .BgCg_ebQ',
        '[class*="Comment"] .BgCg_ebQ'
      ];
      
      let commentElement = null;
      for (const selector of commentSelectors) {
        commentElement = element.querySelector(selector);
        if (commentElement) {
          console.log(`找到评论数元素，使用选择器: ${selector}`);
          break;
        }
      }
      
      if (!commentElement) {
        console.log('未找到评论数元素，尝试查找父元素...');
        // 尝试在父元素中查找
        const parentElement = element.closest('div');
        for (const selector of commentSelectors) {
          commentElement = parentElement?.querySelector(selector);
          if (commentElement) {
            console.log(`在父元素中找到评论数元素，使用选择器: ${selector}`);
            break;
          }
        }
        
        // 如果仍未找到，尝试查找更广泛的范围
        if (!commentElement && parentElement) {
          const grandParentElement = parentElement.closest('div');
          for (const selector of commentSelectors) {
            commentElement = grandParentElement?.querySelector(selector);
            if (commentElement) {
              console.log(`在祖父元素中找到评论数元素，使用选择器: ${selector}`);
              break;
            }
          }
        }
      }
      
      // 默认评论数为0
      let commentCount = 0;
      
      if (commentElement) {
        const commentText = commentElement.textContent.trim();
        console.log(`原始评论文本：${commentText}`);
        
        // 处理可能的单位（万、w等）
        if (commentText.includes('万') || commentText.toLowerCase().includes('w')) {
          const num = parseFloat(commentText.replace(/[^0-9.]/g, ''));
          commentCount = Math.floor(num * 10000);
        } else {
          commentCount = parseInt(commentText.replace(/[^0-9]/g, ''));
        }
        
        console.log(`解析后的评论数：${commentCount}`);
      } else {
        console.log('未找到评论数元素，默认为0');
      }
      
      // 检查点赞数是否满足阈值
      if (likeCount >= likeThreshold) {
        const videoId = element.getAttribute('href');
        if (!videoId) {
          console.log('未找到视频ID，跳过');
          continue;
        }
        
        const fullUrl = videoId.startsWith('http') ? videoId : `https://www.douyin.com${videoId}`;
        
        // 获取视频标题（支持多种选择器）
        const titleSelectors = [
          '.EtttsrEw',
          '.video-title',
          '[data-e2e="video-title"]'
        ];
        
        let titleElement = null;
        for (const selector of titleSelectors) {
          titleElement = element.querySelector(selector);
          if (titleElement) break;
        }
        
        const title = titleElement ? titleElement.textContent.trim() : '';
        
        if (!videos.some(v => v.url === fullUrl)) {
          videos.push({
            url: fullUrl,
            title: title,
            likes: likeCount,
            commentCount: commentCount
          });
          console.log(`添加视频：${title || fullUrl}，点赞数：${likeCount}，评论数：${commentCount}`);
        }
      }
    } catch (error) {
      console.error('提取视频信息时出错:', error);
    }
  }
  
  console.log(`共提取到 ${videos.length} 个符合条件的视频`);
  return videos;
}