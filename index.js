const express = require('express');

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

const logs = [];

function isEmptyValue(value) {
  if (value === null || value === undefined) {
    return true;
  }
  if (typeof value === 'string' && value.trim() === '') {
    return true;
  }
  if (Array.isArray(value) && value.length === 0) {
    return true;
  }
  if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0) {
    return true;
  }
  return false;
}

function cleanObject(obj) {
  if (Array.isArray(obj)) {
    const cleaned = obj
      .map((item) => {
        if (item !== null && typeof item === 'object') {
          return cleanObject(item);
        }
        return item;
      })
      .filter((item) => !isEmptyValue(item));
    return cleaned;
  }

  if (obj !== null && typeof obj === 'object') {
    const result = {};
    for (const key of Object.keys(obj)) {
      const value = obj[key];
      if (value !== null && typeof value === 'object') {
        const cleaned = cleanObject(value);
        if (!isEmptyValue(cleaned)) {
          result[key] = cleaned;
        }
      } else if (!isEmptyValue(value)) {
        result[key] = value;
      }
    }
    return result;
  }

  return obj;
}

function isEmptyDeep(value) {
  if (value === null || value === undefined) {
    return true;
  }
  if (typeof value === 'string') {
    return value.trim() === '';
  }
  if (typeof value !== 'object') {
    return false;
  }
  if (Array.isArray(value)) {
    return value.every(isEmptyDeep);
  }
  const keys = Object.keys(value);
  if (keys.length === 0) {
    return true;
  }
  return keys.every((key) => isEmptyDeep(value[key]));
}

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

  if (event.data !== undefined && event.data !== null) {
    if (typeof event.data === 'object') {
      if (isEmptyDeep(event.data)) {
        return false;
      }
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

  const savedEvents = validEvents.map((event) => {
    const cleaned = { ...event };
    if (cleaned.data !== undefined && cleaned.data !== null && typeof cleaned.data === 'object') {
      cleaned.data = cleanObject(cleaned.data);
    }
    cleaned.timestamp = cleaned.timestamp || Date.now();
    cleaned.receivedAt = new Date().toISOString();
    return cleaned;
  });

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
