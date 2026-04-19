Here is your **PSX APIs documentation converted into clean, structured plain text format**, optimized for Cursor (no Word formatting, no extra spacing issues, clean headings, developer-friendly):

---

# PSX Dashboard API Documentation

(Laravel Proxy + PSX Terminal)

Generated: February 18, 2026 (Asia/Karachi)

---

# 1. Overview

This document lists all endpoints used by the PSX dashboard, including Laravel proxy routes that forward requests to PSX Terminal.

Includes:

* Base URLs
* Endpoint paths
* Parameters
* Sample payloads

No authentication is required (current implementation).

---

# 1.1 Base URLs

Dashboard page:

```
GET /psx/dashboard
```

Laravel API base (proxy):

```
https://<your-domain>/psx
```

Upstream PSX Terminal REST base:

```
https://psxterminal.com/api
```

Upstream WebSocket:

```
wss://psxterminal.com/
```

---

# 1.2 Standard Headers

Use for REST calls:

```
Accept: application/json
Content-Type: application/json   (only if sending body)
```

---

# 1.3 Common Response Format

Success:

```
{
  "success": true,
  "message": "optional",
  "data": {}
}
```

Error:

```
{
  "success": false,
  "message": "error message",
  "data": null
}
```

---

# 2. REST Endpoints (Laravel)

All paths relative to Laravel base URL.

---

## 2.1 List Symbols

Returns all tradable symbols.

Method:

```
GET
```

Endpoint:

```
/psx/symbols
```

Full URL:

```
https://<your-domain>/psx/symbols
```

Example:

```
curl -H "Accept: application/json" \
"https://<your-domain>/psx/symbols"
```

Response:

```
{
  "success": true,
  "data": ["SSGC","HUBC","LUCK","FCCL","DCL"]
}
```

Notes:

* Used for symbol dropdown
* May return thousands of symbols

---

## 2.2 Get Latest Tick (Quote)

Method:

```
GET
```

Endpoint:

```
/psx/ticks/{market}/{symbol}
```

Example:

```
/psx/ticks/REG/SSGC
```

Market Types:

* REG
* FUT
* IDX
* ODL
* BNB

Response:

```
{
  "success": true,
  "data": {
    "symbol": "SSGC",
    "price": 35.46,
    "change": -0.25,
    "changePercent": -0.007,
    "volume": 5000000,
    "trades": 1234,
    "high": 36.1,
    "low": 35.2,
    "timestamp": 1737173200,
    "st": "OPEN"
  }
}
```

Notes:

* Upstream may return compact keys (c, ch, pch, v, tr, h, l, t)
* WebSocket preferred for realtime

---

## 2.3 Get Klines (OHLC Candles)

Method:

```
GET
```

Endpoint:

```
/psx/klines/{symbol}/{tf}?limit={limit}
```

Example:

```
/psx/klines/SSGC/1m?limit=100
```

Timeframes:

* 1m
* 5m
* 15m
* 30m
* 1h
* 1d

Response:

```
{
  "success": true,
  "data": [
    {
      "timestamp": 1737172000000,
      "open": 35.6,
      "high": 35.7,
      "low": 35.5,
      "close": 35.55,
      "volume": 120000
    }
  ]
}
```

Notes:

* Timestamp in milliseconds
* Convert to seconds for LightweightCharts
* RSI calculated using close price (period 14)

---

## 2.4 Market Stats (Top Gainers / Losers)

Method:

```
GET
```

Endpoint:

```
/psx/stats/{market}
```

Example:

```
/psx/stats/REG
```

Response:

```
{
  "success": true,
  "data": {
    "topGainers": [],
    "topLosers": []
  }
}
```

Dashboard typically needs:

* symbol
* price
* changePercent

---

## 2.5 Market Breadth

Method:

```
GET
```

Endpoint:

```
/psx/stats/breadth
```

Response:

```
{
  "success": true,
  "data": {
    "advances": 122,
    "declines": 201,
    "unchanged": 45,
    "advanceDeclineRatio": 0.61
  }
}
```

Important:
Define this route BEFORE `/psx/stats/{market}` to avoid wildcard conflict.

---

## 2.6 Company Profile

Method:

```
GET
```

Endpoint:

```
/psx/companies/{symbol}
```

Example:

```
/psx/companies/SSGC
```

Response:

```
{
  "success": true,
  "data": {
    "symbol": "SSGC",
    "businessDescription": "...",
    "keyPeople": [],
    "scrapedAt": "2026-02-18T09:15:00Z"
  }
}
```

Used in Company tab.

---

## 2.7 Fundamentals

Method:

```
GET
```

Endpoint:

```
/psx/fundamentals/{symbol}
```

Response:

```
{
  "success": true,
  "data": {
    "sector": "Energy",
    "marketCap": "123B",
    "peRatio": 8.7,
    "dividendYield": 5.2,
    "yearChange": -3.1,
    "freeFloat": "45%",
    "volume30Avg": 2345678,
    "isNonCompliant": false,
    "listedIn": "KSE-100, KMI-30"
  }
}
```

---

## 2.8 Dividends

Method:

```
GET
```

Endpoint:

```
/psx/dividends/{symbol}
```

Response:

```
{
  "success": true,
  "data": [
    {
      "ex_date": "2025-11-10",
      "record_date": "2025-11-12",
      "payment_date": "2025-11-25",
      "amount": 1.25,
      "year": 2025
    }
  ]
}
```

Returns array.

---

## 2.9 Proxy (Optional – CORS / SSL Bypass)

Method:

```
GET
```

Endpoint:

```
/psx/proxy/{path}
```

Example:

```
/psx/proxy/api/klines/SSGC/1m?limit=100
```

Rules:

* Only allow `/api/*`
* Forward query params
* Keep allowlist strict (prevent SSRF)

---

# 3. WebSocket (Realtime)

URL:

```
wss://psxterminal.com/
```

---

## Subscribe Format

```
{
  "type": "subscribe",
  "subscriptionType": "marketData | kline | statistics",
  "params": {},
  "requestId": "req-random"
}
```

---

## Tick Update Example

```
{
  "type": "tickUpdate",
  "symbol": "SSGC",
  "tick": {
    "c": 35.46,
    "ch": -0.25,
    "pch": -0.7,
    "v": 5000000,
    "tr": 1234,
    "h": 36.1,
    "l": 35.2,
    "t": 1737173200000,
    "st": "OPEN"
  }
}
```

---

## Kline Update Example

```
{
  "type": "kline",
  "symbol": "SSGC",
  "timeframe": "1m",
  "data": []
}
```

---

## Ping / Pong

If server sends ping, reply:

```
{
  "type": "pong",
  "timestamp": 1737173200000
}
```

---

# 4. Implementation Notes

If charts blank:

* Check LightweightCharts version
* v4 uses:

```
createChart().addCandlestickSeries()
```

If Laravel 404:

* Confirm routes registered
* Confirm correct base URL

Best performance:

* Load symbols + initial klines via REST
* Then update via WebSocket

Ensure JS IDs match HTML:

* psx_symbol
* psx_market
* psx_tf

---

— END —

---

If you want, I can also:

• Convert this into Swagger/OpenAPI YAML
• Convert into Postman collection JSON
• Convert into clean Markdown README
• Generate Flutter/Dart API service layer

Just tell me what format you need 🚀
