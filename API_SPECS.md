# Zii API Specification

This document outlines the RESTful API endpoints required to power the Zii mobile app and the Admin Engine.

## Base Configuration
- **Base URL**: `https://api.zii.app/v1`
- **Authentication**: Bearer Token (JWT) in `Authorization` header.
- **Content-Type**: `application/json`

---

## 1. Client API (Mobile App)

These endpoints power the user-facing interface.

### Feed & Predictions
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/feed` | Get list of open predictions. Supports filtering `?category=Music`. |
| `GET` | `/predictions/:id` | Get details for a specific prediction. |

### User Actions
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/entries` | **Place an Entry.** <br>Payload: `{ prediction_id: string, option_id: string, amount: number }` |
| `GET` | `/entries/active` | Get user's current active predictions. |
| `GET` | `/entries/history` | Get past resolved predictions (won/lost). |

### Wallet
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/wallet/balance` | Get current Zii Coin balance. |
| `POST` | `/wallet/redeem` | Redeem a voucher code. <br>Payload: `{ code: string }` |
| `POST` | `/wallet/buy` | Generates WhatsApp payment link/intent. |

---

## 2. Admin Engine API

These endpoints are for the "Engine" — the admin panel to manage the game loop.

### Prediction Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/admin/predictions` | **Create Prediction.** <br>See "Create Payload" below. |
| `PUT` | `/admin/predictions/:id` | Update typo/details or extend deadline. |
| `POST` | `/admin/predictions/:id/close` | Force close entries (optional, usually auto-scheduled). |

### Game Loop (Resolution)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/admin/predictions/:id/resolve` | **Trigger Payouts.** <br>Payload: `{ winning_option_id: string }`. <br>*Backend Logic*: Updates prediction status to 'RESOLVED', finds all winning entries, credits user wallets. |

### Analytics
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/admin/stats` | Get global pool sizes, liability, and active user count. |

---

## 3. JSON Data Payloads

### Create Prediction (POST /admin/predictions)
```json
{
  "question": "Will ZESA load shed Harare CBD tonight?",
  "category": "Trends & Viral",
  "type": "yes_no",
  "closes_at": "2024-03-20T18:00:00Z",
  "options": [
    { "id": "yes", "label": "Yes (Darkness)", "payout": 15 },
    { "id": "no", "label": "No (Lights On)", "payout": 22 }
  ]
}
```

### Place Entry (POST /entries)
```json
{
  "prediction_id": "pred_123",
  "option_id": "yes",
  "amount": 10
}
```

### Resolve Prediction (POST /admin/predictions/:id/resolve)
```json
{
  "winning_option_id": "yes",
  "notes": "Official ZESA statement released at 19:00"
}
```