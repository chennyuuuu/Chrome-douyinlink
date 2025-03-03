// 监听来自popup的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'startExtract') {
    extractAllContents(request.threshold)
      .then(contents => sendResponse({ success: true, links: contents }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // 保持消息通道开启
  }
});

// 提取所有内容的主要函数（包括视频和图文）
async function extractAllContents(likeThreshold) {
  const contents = [];
  let isScrolling = true;
  let lastHeight = document.documentElement.scrollHeight;
  let noChangeCount = 0;
  let scrollAttempts = 0;
  const maxScrollAttempts = 30; // 增加最大滚动尝试次数
  let expectedContentCount = 0; // 预期作品数量
  
  console.log('开始提取所有作品...');
  
  // 尝试获取博主作品数量
  try {
    const workCountElement = document.querySelector('.count-infos span, .user-tab-count, [data-e2e="user-tab-count"], .tab-num');
    if (workCountElement) {
      const workCountText = workCountElement.textContent.trim();
      const match = workCountText.match(/\d+/);
      if (match) {
        expectedContentCount = parseInt(match[0]);
        console.log(`博主预期作品数量: ${expectedContentCount}`);
      }
    }
  } catch (error) {
    console.error('获取作品数量失败:', error);
  }
  
  // 优化的滚动策略
  while (isScrolling && scrollAttempts < maxScrollAttempts) {
    // 智能滚动：先快速滚动，接近底部时放慢速度
    if (scrollAttempts > maxScrollAttempts * 0.7) {
      // 接近最大尝试次数时，使用更细致的滚动
      for (let i = 0; i < 3; i++) {
        window.scrollBy(0, window.innerHeight / 3);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } else {
      window.scrollTo(0, document.documentElement.scrollHeight);
      await new Promise(resolve => setTimeout(resolve, 3000)); // 等待时间
    }
    
    // 每隔几次滚动，尝试向上滚动一点再向下，以触发可能的懒加载
    if (scrollAttempts % 5 === 0 && scrollAttempts > 0) {
      window.scrollBy(0, -200);
      await new Promise(resolve => setTimeout(resolve, 1000));
      window.scrollBy(0, 300);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // 检查是否到达底部
    const newHeight = document.documentElement.scrollHeight;
    if (newHeight === lastHeight) {
      noChangeCount++;
      console.log(`页面高度未变化，计数：${noChangeCount}`);
      // 连续3次高度没有变化才认为到达底部
      if (noChangeCount >= 3) {
        // 最后再尝试一次完整的页面滚动
        window.scrollTo(0, 0);
        await new Promise(resolve => setTimeout(resolve, 1000));
        window.scrollTo(0, document.documentElement.scrollHeight);
        await new Promise(resolve => setTimeout(resolve, 3000));
        
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
  
  // 获取所有作品元素（包括视频和图文，使用多个选择器以适应不同布局）
  const contentSelectors = [
    // 视频作品选择器
    'a[href^="/video/"]',
    '.xgplayer-video-item a',
    '.author-card-user-video a',
    '.video-feed-item a',
    '.sec-video a',
    '.video-card a',
    '.video-item a',
    '[data-e2e="video-item"] a',
    // 置顶视频选择器
    '.sticky-video a',
    '.pinned-video a',
    // 合集视频选择器
    '.collection-video a',
    '.collection-item a',
    '.mix-container a',
    // 图文作品选择器
    'a[href^="/note/"]',
    '.note-item a',
    '.image-post a',
    '.post-item a',
    '[data-e2e="note-item"] a',
    '.article-item a',
    '.image-card a',
    // 通用作品选择器（可能同时包含视频和图文）
    '.post-card a',
    '.content-card a',
    '.feed-item a'
  ];
  
  // 第一阶段：收集所有可能的作品元素
  let allContentElements = [];
  for (const selector of contentSelectors) {
    const elements = document.querySelectorAll(selector);
    console.log(`选择器 ${selector} 找到 ${elements.length} 个元素`);
    allContentElements = [...allContentElements, ...elements];
  }
  
  // 去除重复元素（可能有多个选择器匹配到同一个元素）
  const uniqueElements = Array.from(new Set(allContentElements));
  console.log(`去重后共找到 ${uniqueElements.length} 个作品元素`);
  
  // 检查是否有特殊类型的作品
  const pinnedContents = document.querySelectorAll('.sticky-video a, .pinned-video a, [data-e2e="pinned-video"] a, .sticky-note a, .pinned-note a');
  if (pinnedContents.length > 0) {
    console.log(`找到 ${pinnedContents.length} 个置顶作品`);
  }
  
  const contentElements = uniqueElements;
  console.log(`最终处理的作品元素数量: ${contentElements.length} 个`);
  
  // 遍历作品元素，提取链接、标题、点赞数和类型
  for (const element of contentElements) {
    try {
      // 获取作品链接
      const contentId = element.getAttribute('href');
      if (!contentId) {
        console.log('未找到作品ID，跳过');
        continue;
      }
      
      // 判断作品类型（视频或图文）
      const isVideo = contentId.includes('/video/');
      const isNote = contentId.includes('/note/');
      let contentType = 'unknown';
      
      if (isVideo) {
        contentType = 'video';
      } else if (isNote) {
        contentType = 'note';
      } else {
        // 尝试通过其他特征判断类型
        const hasVideoIcon = !!element.querySelector('.video-icon, .play-icon, [data-e2e="video-icon"]');
        const hasImageIcon = !!element.querySelector('.image-icon, .photo-icon, [data-e2e="image-icon"]');
        
        if (hasVideoIcon) {
          contentType = 'video';
        } else if (hasImageIcon) {
          contentType = 'note';
        } else {
          // 默认按视频处理，但标记为未确定类型
          contentType = 'video';
          console.log('无法确定作品类型，默认按视频处理');
        }
      }
      
      // 获取点赞数（支持多种选择器）
      const likeSelectors = [
        '.author-card-user-video-like .BgCg_ebQ',
        '.author-card-user-video-like .video-count',
        '.like-count',
        '[data-e2e="like-count"]',
        '.video-data .like-icon + span',
        '.note-data .like-icon + span',
        '.content-stats .like-count',
        '.interaction-info .like-num',
        '.count-item .like-num',
        '.count-wrapper .like-count'
      ];
      
      let likeElement = null;
      for (const selector of likeSelectors) {
        likeElement = element.querySelector(selector);
        if (likeElement) break;
      }
      
      if (!likeElement) {
        // 尝试在父元素或相邻元素中查找
        const parentElement = element.closest('.content-item, .video-card, .note-card, .feed-item');
        if (parentElement) {
          for (const selector of likeSelectors) {
            likeElement = parentElement.querySelector(selector);
            if (likeElement) break;
          }
        }
      }
      
      // 处理点赞数
      let likeCount = 0;
      if (likeElement) {
        const likeText = likeElement.textContent.trim();
        console.log(`原始点赞文本：${likeText}`);
        
        // 处理可能的单位（万、w等）
        if (likeText.includes('万') || likeText.toLowerCase().includes('w')) {
          const num = parseFloat(likeText.replace(/[^0-9.]/g, ''));
          likeCount = Math.floor(num * 10000);
        } else {
          likeCount = parseInt(likeText.replace(/[^0-9]/g, '')) || 0;
        }
        
        console.log(`解析后的点赞数：${likeCount}`);
      } else {
        console.log('未找到点赞数元素');
      }
      
      // 获取评论数
      const commentSelectors = [
        '.comment-count',
        '[data-e2e="comment-count"]',
        '.video-data .comment-icon + span',
        '.note-data .comment-icon + span',
        '.content-stats .comment-count',
        '.interaction-info .comment-num',
        '.count-item .comment-num',
        '.count-wrapper .comment-count'
      ];
      
      let commentElement = null;
      for (const selector of commentSelectors) {
        commentElement = element.querySelector(selector);
        if (commentElement) break;
      }
      
      if (!commentElement) {
        // 尝试在父元素或相邻元素中查找
        const parentElement = element.closest('.content-item, .video-card, .note-card, .feed-item');
        if (parentElement) {
          for (const selector of commentSelectors) {
            commentElement = parentElement.querySelector(selector);
            if (commentElement) break;
          }
        }
      }
      
      // 处理评论数
      let commentCount = 0;
      if (commentElement) {
        const commentText = commentElement.textContent.trim();
        console.log(`原始评论文本：${commentText}`);
        
        // 处理可能的单位（万、w等）
        if (commentText.includes('万') || commentText.toLowerCase().includes('w')) {
          const num = parseFloat(commentText.replace(/[^0-9.]/g, ''));
          commentCount = Math.floor(num * 10000);
        } else {
          commentCount = parseInt(commentText.replace(/[^0-9]/g, '')) || 0;
        }
        
        console.log(`解析后的评论数：${commentCount}`);
      } else {
        console.log('未找到评论数元素');
      }
      
      // 获取发布时间
      const timeSelectors = [
        '.publish-time',
        '[data-e2e="publish-time"]',
        '.video-create-time',
        '.note-create-time',
        '.content-time',
        '.time-info',
        '.post-time'
      ];
      
      let timeElement = null;
      for (const selector of timeSelectors) {
        timeElement = element.querySelector(selector);
        if (timeElement) break;
      }
      
      let publishTime = '';
      if (timeElement) {
        publishTime = timeElement.textContent.trim();
        console.log(`发布时间：${publishTime}`);
      } else {
        console.log('未找到发布时间元素');
      }
      
      // 检查点赞数是否满足阈值
      if (likeCount >= likeThreshold) {
        const fullUrl = contentId.startsWith('http') ? contentId : `https://www.douyin.com${contentId}`;
        
        // 获取作品标题（支持多种选择器）
        const titleSelectors = [
          '.EtttsrEw',
          '.video-title',
          '[data-e2e="video-title"]',
          '.content-title',
          '.note-title',
          '.post-title',
          '.desc',
          '.content-desc'
        ];
        
        let titleElement = null;
        for (const selector of titleSelectors) {
          titleElement = element.querySelector(selector);
          if (titleElement) break;
        }
        
        // 处理标题，如果没有标题则使用替代文本
        let title = '';
        if (titleElement) {
          title = titleElement.textContent.trim();
        } else {
          // 尝试在父元素中查找标题
          const parentElement = element.closest('.content-item, .video-card, .note-card, .feed-item');
          if (parentElement) {
            for (const selector of titleSelectors) {
              titleElement = parentElement.querySelector(selector);
              if (titleElement) {
                title = titleElement.textContent.trim();
                break;
              }
            }
          }
          
          // 如果仍然没有找到标题，使用替代文本
          if (!title) {
            // 提取ID作为标识
            const idMatch = contentId.match(/\/([^\/]+)\/?$/);
            const extractedId = idMatch ? idMatch[1] : '';
            title = contentType === 'video' ? `无标题视频 (ID: ${extractedId})` : `无标题图文 (ID: ${extractedId})`;
          }
        }
        
        // 获取图文作品的首图或摘要（如果是图文作品）
        let coverImage = '';
        let summary = '';
        if (contentType === 'note') {
          // 尝试获取封面图
          const imageSelectors = [
            '.note-cover img',
            '.post-cover img',
            '.cover-image',
            '.first-image img'
          ];
          
          let imageElement = null;
          for (const selector of imageSelectors) {
            imageElement = element.querySelector(selector);
            if (imageElement) break;
          }
          
          if (imageElement) {
            coverImage = imageElement.getAttribute('src') || '';
          }
          
          // 尝试获取摘要
          const summarySelectors = [
            '.note-summary',
            '.post-summary',
            '.content-brief',
            '.desc-text'
          ];
          
          let summaryElement = null;
          for (const selector of summarySelectors) {
            summaryElement = element.querySelector(selector);
            if (summaryElement) break;
          }
          
          if (summaryElement) {
            summary = summaryElement.textContent.trim();
          }
        }
        
        // 检查是否已经添加过相同的作品
        if (!contents.some(c => c.url === fullUrl)) {
          // 创建作品对象
          const contentObject = {
            url: fullUrl,
            title: title,
            type: contentType,
            likes: likeCount,
            comments: commentCount,
            publishTime: publishTime
          };
          
          // 如果是图文作品，添加额外信息
          if (contentType === 'note' && (coverImage || summary)) {
            if (coverImage) contentObject.coverImage = coverImage;
            if (summary) contentObject.summary = summary;
          }
          
          contents.push(contentObject);
          console.log(`添加${contentType === 'video' ? '视频' : '图文'}：${title || fullUrl}，点赞数：${likeCount}，评论数：${commentCount}`);
        }
      }
    } catch (error) {
      console.error('提取作品信息时出错:', error);
    }
  }
  
  console.log(`共提取到 ${contents.length} 个符合条件的作品`);
  return contents;
}
}