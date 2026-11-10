# BalanceVault – Secure Digital Banking Demo

## 1. Project Overview

**BalanceVault** is a secure digital banking demonstration application designed to demonstrate reliable and traceable money movement.

The application allows users to register, log in, view their account balance, deposit demo funds, withdraw demo funds, and view transaction history.

It also provides an admin dashboard and audit logs to monitor user activities.

The project focuses on preventing common money movement problems such as duplicate transactions, unauthorized access, and withdrawals exceeding the available balance.

**Note:** BalanceVault is an educational demonstration project. It does not process real money or connect to actual bank accounts.

## 2. Project Objectives

- Provide secure user registration and login.
- Implement JWT-based authentication.
- Support demo deposits and withdrawals.
- Prevent duplicate transaction processing through idempotency keys.
- Protect accounts from insufficient-balance withdrawals.
- Maintain transaction history.
- Record important activities through audit logs.
- Restrict administrative resources using role-based authorization.

## 3. Technologies Used

| Component | Technology |
|---|---|
| Frontend | React.js |
| Frontend tooling | Vite |
| Styling | CSS |
| Backend | Node.js |
| Backend framework | Express.js |
| Database | PostgreSQL |
| ORM | Prisma |
| Authentication | JSON Web Tokens (JWT) |
| Password security | bcrypt |
| API testing | Postman |
| Development environment | Visual Studio Code |

## 4. Project Structure

```text
BalanceVault/
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── App.css
│   │   └── ...
│   └── package.json
│
├── backend/
│   ├── prisma/
│   │   └── schema.prisma
│   ├── src/
│   │   ├── middleware/
│   │   ├── routes/
│   │   └── lib/
│   ├── prisma.config.ts
│   ├── server.js
│   └── package.json
│
└── README.md
```

## 5. Main Features

### User Authentication
- User registration.
- User login.
- Password hashing.
- JWT-based authentication.
- Authenticated user profile.

### Account Management
- Automatic account creation during registration.
- Unique account number.
- Account balance display.
- Account status verification.

### Deposit
- Users can deposit demo funds.
- Balance is updated after a successful deposit.
- Transactions are recorded.

### Withdrawal
- Users can withdraw demo funds.
- Insufficient-balance withdrawals are rejected.
- Balance updates are performed transactionally.

### Idempotency Protection
- Uses unique idempotency keys for deposit and withdrawal requests.
- Prevents duplicate money movement when the same request is retried with the same key and matching details.

### Transaction History
- Displays deposits and withdrawals.
- Shows transaction amounts, descriptions, statuses, and dates.

### Admin Dashboard
- Admin-only dashboard.
- User activity management and monitoring.
- Protected using role-based authorization.

### Audit Logging
- Records important user activities.
- Tracks login, deposit, and withdrawal events.
- Stores actor details, action, timestamp, and available request information.

## 6. Database Design

BalanceVault uses PostgreSQL with Prisma ORM.

Main database models:

1. **User** – Stores user information, email, password hash, and role.
2. **Account** – Stores account number, account balance, status, and user association.
3. **Transaction** – Stores deposit and withdrawal records.
4. **AuditLog** – Stores records of important system activities.

## 7. API Endpoints

Base URL:

```text
http://localhost:5000/api
```

### Authentication APIs

| Method | Endpoint | Purpose |
|---|---|---|
| POST | /auth/register | Register a user |
| POST | /auth/login | Log in |
| GET | /auth/me | Get authenticated user |

### User APIs

| Method | Endpoint | Purpose |
|---|---|---|
| GET | /users/dashboard | View account dashboard |
| GET | /users/transactions | View transaction history |
| GET | /users/ | Admin-only user listing |

### Transaction APIs

| Method | Endpoint | Purpose |
|---|---|---|
| POST | /transactions/deposit | Deposit demo funds |
| POST | /transactions/withdraw | Withdraw demo funds |

### Admin APIs

| Method | Endpoint | Purpose |
|---|---|---|
| GET | /admin/dashboard | View admin dashboard |
| GET | /admin/audit-logs | Retrieve audit logs |

Protected endpoints require a valid JWT Bearer token. Admin endpoints require the ADMIN role.

## 8. Installation and Execution

### Prerequisites

- Node.js and npm
- PostgreSQL
- Visual Studio Code
- Postman (for API testing)

### Step 1: Clone or open the project

Open the BalanceVault project folder in Visual Studio Code.

### Step 2: Configure the backend

Open PowerShell:

```powershell
cd backend
npm install
```

Configure the backend `.env` file with your PostgreSQL database connection and JWT settings.

Required environment variables:

```env
PORT=5000
NODE_ENV=development
DATABASE_URL=your_postgresql_connection_string
JWT_SECRET=your_private_secret
JWT_EXPIRES_IN=your_token_expiry
```

Do not upload your real `.env` file or secrets to GitHub.

### Step 3: Generate Prisma Client and prepare database

```powershell
npx prisma generate
npx prisma migrate deploy
```

Use the existing project migrations. Ensure the PostgreSQL database is running and configured.

### Step 4: Start the backend

```powershell
npm run dev
```

Backend URL:

```text
http://localhost:5000
```

Health check:

```text
http://localhost:5000/api/health
```

### Step 5: Start the frontend

Open a second PowerShell terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open the local URL printed by Vite, normally:

```text
http://localhost:5173
```

## 9. Security Measures

- Password hashing using bcrypt.
- JWT authentication.
- Role-based access control.
- Protected admin routes.
- Server-side input validation.
- Insufficient-balance withdrawal protection.
- Database transactions for money movement.
- Idempotency keys for duplicate request protection.
- Audit logging for important activities.

## 10. Testing and Verification

The following tests were performed during development:

| Test | Expected result | Observed result |
|---|---|---|
| User registration | Successful registration | Passed |
| User login | Successful login | Passed |
| Dashboard | Account details displayed | Passed |
| Deposit | Balance increases | Passed |
| Withdrawal | Balance decreases | Passed |
| Insufficient balance | Withdrawal rejected | Passed |
| Duplicate deposit request | No second balance update | Passed |
| Duplicate withdrawal request | No second balance update | Passed |
| Admin dashboard with admin token | 200 OK | Passed |
| Audit logs with admin token | 200 OK | Passed |
| Admin dashboard with normal token | 403 Forbidden | Passed |
| Audit logs with normal token | 403 Forbidden | Passed |
| Transaction history | Records displayed | Passed |

## 11. Future Enhancements

- Email and OTP verification.
- Password reset functionality.
- More advanced admin reporting.
- Exportable transaction statements.
- Improved automated testing.
- Deployment to a cloud hosting platform.
- Enhanced monitoring and security controls.

## 12. Conclusion

BalanceVault demonstrates how a digital banking application can support authenticated users, controlled money movement, transaction tracking, and administrative monitoring.

By combining React, Node.js, Express, PostgreSQL, and Prisma, the project demonstrates important software engineering concepts including authentication, authorization, database transactions, idempotency, validation, and audit logging.

**Project Name:** BalanceVault
**Project Type:** Full-Stack Web Application
**Purpose:** Secure Digital Banking Demonstration