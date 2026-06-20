const express = require('express');

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

const logs = [];

function isValidEvent(event) {
  if (!event || typeof event !== 'object') {
    return false;
  }

  if (!event.eventName || typeof event.eventName !== 'string' || event.eventName.trim() === '') {
    return false;
  }

  if (event.timestamp !== undefined) {
    const ts = Number(event.timestamp);
    if (!Number.isFinite(ts) || ts <= 0) {
      return false;
    }
  }

  if (event.data !== undefined && event.data !== null && typeof event.data === 'object') {
    if (Object.keys(event.data).length === 0) {
      return false;
    }
  }

  return true;
}

function filterEvents(events) {
  if (!Array.isArray(events)) {
    if (isValidEvent(events)) {
      return [events];
    }
    return [];
  }

  return events.filter(isValidEvent);
}

app.post('/api/track', (req, res) => {
  const rawBody = req.body;

  if (!rawBody || (typeof rawBody === 'object' && Object.keys(rawBody).length === 0)) {
    return res.status(400).json({
      code: 400,
      message: '请求体为空',
    });
  }

  let events = [];

  if (Array.isArray(rawBody.events)) {
    events = rawBody.events;
  } else if (Array.isArray(rawBody)) {
    events = rawBody;
  } else if (typeof rawBody === 'object' && rawBody.eventName) {
    events = [rawBody];
  } else {
    return res.status(400).json({
      code: 400,
      message: '无法识别的事件数据格式',
    });
  }

  const totalReceived = events.length;
  const validEvents = filterEvents(events);
  const filteredCount = totalReceived - validEvents.length;

  if (validEvents.length === 0) {
    return res.status(200).json({
      code: 200,
      message: '全部事件均无效，已过滤',
      received: totalReceived,
      filtered: filteredCount,
      saved: 0,
    });
  }

  const savedEvents = validEvents.map((event) => ({
    ...event,
    timestamp: event.timestamp || Date.now(),
    receivedAt: new Date().toISOString(),
  }));

  logs.push(...savedEvents);

  return res.status(200).json({
    code: 200,
    message: filteredCount > 0 ? `已过滤 ${filteredCount} 条无效事件` : '全部事件接收成功',
    received: totalReceived,
    filtered: filteredCount,
    saved: savedEvents.length,
  });
});

app.get('/api/track', (_req, res) => {
  res.json({
    code: 200,
    total: logs.length,
    data: logs,
  });
});

app.listen(PORT, () => {
  console.log(`埋点日志服务已启动: http://localhost:${PORT}`);
});
