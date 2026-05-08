# Money Flow Bank — Backend System

**Admin:** Happiness Ogbonnaya  
**Email:** happiness.ogbonnaya@moneyflowbank.com  
**Built with:** Node.js + Express  
**Integrated with:** NibssByPhoenix API

---

## Quick Start

```bash
# Install dependencies
npm install

# Run the setup script (registers bank on NIBSS, creates first customer)
node src/scripts/setup.js

# Update .env with the credentials printed by setup script
# Then start the server
npm start
```

Server runs on: `http://localhost:3000`

---

## Setup Flow

### 1. Register Money Flow Bank on NIBSS
```http
POST https://nibssbyphoenix.onrender.com/api/fintech/onboard
{
  "name": "Money Flow Bank",
  "email": "moneyflowbank@tsacademy.com"
}
```
Save the returned `apiKey`, `apiSecret`, `bankCode`, `bankName` in `.env`

### 2. Login to NIBSS (get JWT)
```http
POST /api/admin/nibss/login
{
  "apiKey": "your_api_key",
  "apiSecret": "your_api_secret"
}
```

### 3. Seed a BVN for a customer
```http
POST /api/admin/kyc/bvn
{
  "bvn": "22234567890",
  "firstName": "Happiness",
  "lastName": "Ogbonnaya",
  "dob": "1990-05-15",
  "phone": "08012345678"
}
```

---

## API Endpoints

### Customer Onboarding

#### Register (with KYC verification)
```http
POST /api/customers/register
{
  "firstName": "Happiness",
  "lastName": "Ogbonnaya",
  "email": "happiness@email.com",
  "password": "securepassword",
  "phone": "08012345678",
  "kycType": "bvn",
  "kycID": "22234567890",
  "dob": "1990-05-15"
}
```
**Note:** BVN/NIN is validated with NIBSS before registration is allowed.

#### Login
```http
POST /api/customers/login
{
  "email": "happiness@email.com",
  "password": "securepassword"
}
```
Returns a JWT token. Include in all protected requests:
```
Authorization: Bearer <token>
```

---

### Account Management (requires auth)

#### Create Bank Account
```http
POST /api/accounts/create
Authorization: Bearer <token>
```
- Max 1 account per customer
- Pre-funded with ₦15,000

#### Check Balance
```http
GET /api/accounts/balance
Authorization: Bearer <token>
```

#### Name Enquiry (verify recipient before transfer)
```http
GET /api/accounts/name-enquiry/1234567890
Authorization: Bearer <token>
```

#### Get Account Details
```http
GET /api/accounts/details
Authorization: Bearer <token>
```

---

### Transactions (requires auth)

#### Transfer Funds
```http
POST /api/transactions/transfer
Authorization: Bearer <token>
{
  "toAccountNumber": "1234567890",
  "amount": 5000,
  "description": "Payment for services"
}
```
Supports both intra-bank and inter-bank transfers.

#### Transaction History
```http
GET /api/transactions/history
Authorization: Bearer <token>
```
**Data Privacy:** Returns ONLY the authenticated customer's transactions.

#### Transaction Status (TSQ)
```http
GET /api/transactions/status/TX1234567890
Authorization: Bearer <token>
```

---

### Admin Endpoints

#### System Status
```http
GET /api/admin/status
```

#### Register Bank on NIBSS
```http
POST /api/admin/nibss/onboard
{
  "name": "Money Flow Bank",
  "email": "admin@moneyflowbank.com"
}
```

#### NIBSS Login
```http
POST /api/admin/nibss/login
{
  "apiKey": "your_nibss_api_key",
  "apiSecret": "your_nibss_api_secret"
}
```

#### Insert BVN Record
```http
POST /api/admin/kyc/bvn
{
  "bvn": "22234567890",
  "firstName": "John",
  "lastName": "Doe",
  "dob": "1990-01-15",
  "phone": "08012345678"
}
```

#### Insert NIN Record
```http
POST /api/admin/kyc/nin
{
  "nin": "33345678901",
  "firstName": "Jane",
  "lastName": "Doe",
  "dob": "1992-03-20"
}
```

---

## Architecture

```
moneyflow-bank/
├── src/
│   ├── index.js                    # Express app entry point
│   ├── routes/
│   │   └── index.js                # All route definitions
│   ├── controllers/
│   │   ├── onboardingController.js # Customer registration & login
│   │   ├── accountController.js    # Account CRUD & balance
│   │   ├── transactionController.js # Transfers & history
│   │   └── adminController.js      # Admin/NIBSS operations
│   ├── services/
│   │   └── nibssService.js         # NibssByPhoenix API integration
│   ├── models/
│   │   └── database.js             # In-memory data store
│   ├── middleware/
│   │   └── auth.js                 # JWT authentication
│   └── scripts/
│       └── setup.js                # First-time setup script
├── .env                            # Environment variables
├── package.json
└── README.md
```

## Security Features

1. **KYC Enforcement** — No account without BVN/NIN verification
2. **JWT Authentication** — All customer routes protected
3. **Data Isolation** — Customers only see their own data
4. **One Account Rule** — Max 1 account per customer
5. **Rate Limiting** — 100 requests per 15 minutes
6. **Password Hashing** — bcrypt with salt rounds
