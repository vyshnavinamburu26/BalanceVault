
import { useState, useEffect, useCallback } from "react";
import "./App.css";

const API = "https://balancevault-backend.onrender.com/api";

function App() {
  const [mode, setMode] = useState("login");

  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: ""
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");

  const [token, setToken] = useState(
    localStorage.getItem("balancevault_token") || ""
  );

  const [user, setUser] = useState(null);
  const [account, setAccount] = useState(null);
  const [transactions, setTransactions] = useState([]);

  const [dashboardLoading, setDashboardLoading] = useState(false);

  const [adminInfo, setAdminInfo] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditPagination, setAuditPagination] = useState(null);

  const [transactionType, setTransactionType] = useState("deposit");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  function showMessage(text, type = "success") {
    setMessage(text);
    setMessageType(type);
  }

  function handleChange(e) {
    setForm({
      ...form,
      [e.target.name]: e.target.value
    });
  }

  // LOGOUT
  function logout() {
    localStorage.removeItem("balancevault_token");

    setToken("");
    setUser(null);
    setAccount(null);
    setTransactions([]);

    setAdminInfo(null);
    setAuditLogs([]);
    setAuditPagination(null);

    setAmount("");
    setDescription("");
    setMessage("");
  }

  // LOAD ADMIN OR CUSTOMER DASHBOARD
  const loadDashboard = useCallback(async () => {
    if (!token) return;

    setDashboardLoading(true);

    try {
      const headers = {
        Authorization: `Bearer ${token}`
      };

      // VERIFY AUTHENTICATED USER
      const meResponse = await fetch(`${API}/auth/me`, {
        headers
      });

      const meData = await meResponse.json();

      if (meResponse.status === 401) {
        logout();
        showMessage("Your session expired. Please log in again.", "error");
        return;
      }

      if (!meResponse.ok) {
        throw new Error(meData.message || "Unable to verify account");
      }

      const currentUser = meData.user;
      setUser(currentUser);

      // ADMIN DASHBOARD
      if (currentUser.role === "ADMIN") {
        const [dashboardResponse, auditResponse] = await Promise.all([
          fetch(`${API}/admin/dashboard`, { headers }),
          fetch(`${API}/admin/audit-logs?page=1&limit=10`, { headers })
        ]);

        const dashboardData = await dashboardResponse.json();
        const auditData = await auditResponse.json();

        if (dashboardResponse.status === 401 ||
            auditResponse.status === 401) {
          logout();
          showMessage("Your session expired. Please log in again.", "error");
          return;
        }

        if (!dashboardResponse.ok) {
          throw new Error(
            dashboardData.message || "Unable to load admin dashboard"
          );
        }

        if (!auditResponse.ok) {
          throw new Error(
            auditData.message || "Unable to load audit logs"
          );
        }

        setAdminInfo(dashboardData.admin);
        setAuditLogs(auditData.logs || []);
        setAuditPagination(auditData.pagination || null);

        setAccount(null);
        setTransactions([]);

        return;
      }

      // CUSTOMER DASHBOARD
      const [dashboardResponse, transactionsResponse] = await Promise.all([
        fetch(`${API}/users/dashboard`, { headers }),
        fetch(`${API}/users/transactions`, { headers })
      ]);

      const dashboardData = await dashboardResponse.json();
      const transactionsData = await transactionsResponse.json();

      if (dashboardResponse.status === 401 ||
          transactionsResponse.status === 401) {
        logout();
        showMessage("Your session expired. Please log in again.", "error");
        return;
      }

      if (!dashboardResponse.ok || !transactionsResponse.ok) {
        throw new Error(
          dashboardData.message ||
          transactionsData.message ||
          "Unable to load customer dashboard"
        );
      }

      setUser(dashboardData.user);
      setAccount(dashboardData.account);
      setTransactions(transactionsData.transactions || []);

      setAdminInfo(null);
      setAuditLogs([]);
      setAuditPagination(null);

    } catch (error) {
      showMessage(
        error.message || "Unable to connect to the server.",
        "error"
      );
    } finally {
      setDashboardLoading(false);
    }
  }, [token]);

  // LOAD DASHBOARD WHEN TOKEN CHANGES
  useEffect(() => {
    if (token) {
      loadDashboard();
    }
  }, [token, loadDashboard]);

  // LOGIN AND REGISTRATION
  async function handleSubmit(e) {
    e.preventDefault();

    setLoading(true);
    setMessage("");

    try {
      const endpoint =
        mode === "login" ? "/auth/login" : "/auth/register";

      const payload =
        mode === "login"
          ? {
              email: form.email,
              password: form.password
            }
          : {
              fullName: form.fullName,
              email: form.email,
              password: form.password
            };

      const response = await fetch(API + endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Request failed");
      }

      if (mode === "register") {
        showMessage("Registration successful! Please log in.");

        setMode("login");

        setForm({
          fullName: "",
          email: form.email,
          password: ""
        });
      } else {
        if (!data.token) {
          throw new Error("Login succeeded but no token was returned.");
        }

        localStorage.setItem("balancevault_token", data.token);

        setUser(data.user || null);
        setToken(data.token);

        showMessage("Login successful!");
      }

    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setLoading(false);
    }
  }

  // DEPOSIT OR WITHDRAW
  async function handleTransaction(e) {
    e.preventDefault();

    const numericAmount = Number(amount);

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      showMessage("Enter a valid amount greater than zero.", "error");
      return;
    }

    if (!/^\d{1,13}(\.\d{1,2})?$/.test(amount.trim())) {
      showMessage(
        "Enter an amount with up to two decimal places.",
        "error"
      );
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const endpoint =
        transactionType === "deposit" ? "/deposit" : "/withdraw";

      const idempotencyKey =
        window.crypto?.randomUUID?.() ||
        `bv-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      const response = await fetch(
        `${API}/transactions${endpoint}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            "Idempotency-Key": idempotencyKey
          },
          body: JSON.stringify({
            amount: amount.trim(),
            description:
              description.trim() ||
              (transactionType === "deposit"
                ? "BalanceVault deposit"
                : "BalanceVault withdrawal")
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Transaction failed");
      }

      showMessage(
        data.duplicate
          ? "This request was already processed. No second transaction was made."
          : `${transactionType === "deposit" ? "Deposit" : "Withdrawal"} successful!`
      );

      setAmount("");
      setDescription("");

      await loadDashboard();

    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setLoading(false);
    }
  }

  // FORMAT CURRENCY
  function formatMoney(value) {
    return Number(value || 0).toLocaleString("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2
    });
  }

  // FORMAT DATE
  function formatDate(value) {
    if (!value) return "—";

    return new Date(value).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short"
    });
  }

  // AUTHENTICATED DASHBOARD
  if (token) {
    return (
      <main className="app-shell">

        <nav className="navbar">
          <div className="brand">
            <span className="brand-icon">B</span>
            <span>BalanceVault</span>
          </div>

          <div className="nav-user">
            <span>{user?.fullName || "Account Holder"}</span>

            <button className="logout-button" onClick={logout}>
              Log out
            </button>
          </div>
        </nav>

        <section className="welcome-card">
          <div className="welcome-content">
            <span className="eyebrow">SECURE DIGITAL BANKING</span>

            <h1>Welcome, {user?.fullName || "User"}!</h1>

            <p>
              Your money movement, protected by a reliable
              and traceable ledger.
            </p>

            <span className="status-pill">
              ● Authenticated session
            </span>
          </div>

          <div className="vault-art">BV</div>
        </section>

        {message && (
          <div className={`message dashboard-message ${messageType}`}>
            {message}
          </div>
        )}

        {/* ADMIN DASHBOARD */}
        {user?.role === "ADMIN" ? (

          <section className="dashboard-card">

            <div className="section-heading">
              <div>
                <span className="eyebrow">ADMINISTRATION</span>
                <h2>Admin Dashboard</h2>
                <p>Manage and monitor BalanceVault activity.</p>
              </div>

              <button
                className="refresh-button"
                onClick={loadDashboard}
                disabled={dashboardLoading}
              >
                {dashboardLoading ? "Loading..." : "Refresh"}
              </button>
            </div>

            {adminInfo && (
              <div className="account-grid">

                <div className="account-info-card">
                  <span>ADMIN NAME</span>
                  <h2>{adminInfo.fullName}</h2>
                  <p>{adminInfo.email}</p>
                </div>

                <div className="account-info-card">
                  <span>ACCESS ROLE</span>
                  <h2>{adminInfo.role}</h2>
                  <p>Authorized administrator</p>
                </div>

                <div className="account-info-card">
                  <span>TOTAL AUDIT LOGS</span>
                  <h2>{auditPagination?.totalLogs ?? 0}</h2>
                  <p>Recorded system activities</p>
                </div>

              </div>
            )}

            <div className="section-heading">
              <div>
                <span className="eyebrow">SECURITY MONITORING</span>
                <h2>Audit Logs</h2>
              </div>
            </div>

            {auditLogs.length === 0 ? (
              <p className="empty-state">No audit logs found.</p>
            ) : (

              <div className="table-wrapper">
                <table className="transaction-table">

                  <thead>
                    <tr>
                      <th>Actor</th>
                      <th>Action</th>
                      <th>Entity</th>
                      <th>IP Address</th>
                      <th>Date</th>
                      <th>Details</th>
                    </tr>
                  </thead>

                  <tbody>
                    {auditLogs.map((log) => (
                      <tr key={log.id}>
                        <td>
                          {log.actor?.fullName || "System"}
                          <br />
                          {log.actor?.email || "—"}
                        </td>

                        <td>{log.action}</td>
                        <td>{log.entity || "—"}</td>
                        <td>{log.ipAddress || "—"}</td>
                        <td>{formatDate(log.createdAt)}</td>

                        <td>
                          {log.details
                            ? JSON.stringify(log.details)
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>

                </table>
              </div>
            )}

            <p className="security-note">
              Showing {auditLogs.length} recent audit records.
              Total records: {auditPagination?.totalLogs ?? 0}
            </p>

          </section>

        ) : dashboardLoading && !account ? (

          <section className="dashboard-card">
            <p>Loading your account information...</p>
          </section>

        ) : account ? (

          <>
            {/* CUSTOMER ACCOUNT DETAILS */}
            <section className="account-grid">

              <div className="balance-card">
                <span>AVAILABLE BALANCE</span>
                <h2>{formatMoney(account.balance)}</h2>
                <p>Account: {account.accountNumber}</p>
              </div>

              <div className="account-info-card">
                <span>ACCOUNT STATUS</span>
                <h2>{account.status}</h2>
                <p>Your account is currently active.</p>
              </div>

              <div className="account-info-card">
                <span>ACCOUNT HOLDER</span>
                <h2>{user?.fullName || "Account Holder"}</h2>
                <p>{user?.email}</p>
              </div>

            </section>

            {/* DEPOSIT AND WITHDRAW */}
            <section className="dashboard-card">

              <div className="section-heading">
                <div>
                  <span className="eyebrow">MONEY MOVEMENT</span>
                  <h2>Manage your money</h2>
                </div>
              </div>

              <div className="transaction-tabs">

                <button
                  type="button"
                  className={transactionType === "deposit" ? "active" : ""}
                  onClick={() => {
                    setTransactionType("deposit");
                    setMessage("");
                  }}
                >
                  Deposit
                </button>

                <button
                  type="button"
                  className={transactionType === "withdraw" ? "active" : ""}
                  onClick={() => {
                    setTransactionType("withdraw");
                    setMessage("");
                  }}
                >
                  Withdraw
                </button>

              </div>

              <form className="money-form" onSubmit={handleTransaction}>

                <label>
                  Amount (₹)

                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="Enter amount"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                  />
                </label>

                <label>
                  Description (optional)

                  <input
                    type="text"
                    maxLength="150"
                    placeholder="Example: Monthly savings"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </label>

                <button
                  className="primary-button"
                  type="submit"
                  disabled={
                    loading ||
                    !account ||
                    account.status !== "ACTIVE"
                  }
                >
                  {loading
                    ? "Processing..."
                    : transactionType === "deposit"
                      ? "Deposit money"
                      : "Withdraw money"}
                </button>

              </form>

              <p className="security-note">
                Transactions are recorded with unique request keys
                to help prevent duplicate money movements.
              </p>

            </section>

            {/* TRANSACTION HISTORY */}
            <section className="dashboard-card history-card">

              <div className="section-heading">
                <div>
                  <span className="eyebrow">ACCOUNT ACTIVITY</span>
                  <h2>Recent transactions</h2>
                </div>

                <button
                  className="refresh-button"
                  onClick={loadDashboard}
                  disabled={dashboardLoading}
                >
                  Refresh
                </button>
              </div>

              {transactions.length === 0 ? (

                <p className="empty-state">
                  No transactions found. Your transactions
                  will appear here.
                </p>

              ) : (

                <div className="table-wrapper">
                  <table className="transaction-table">

                    <thead>
                      <tr>
                        <th>Type</th>
                        <th>Amount</th>
                        <th>Description</th>
                        <th>Status</th>
                        <th>Date</th>
                      </tr>
                    </thead>

                    <tbody>
                      {transactions.map((transaction) => (
                        <tr key={transaction.id}>

                          <td>
                            <span
                              className={
                                transaction.type === "DEPOSIT"
                                  ? "type-deposit"
                                  : "type-withdraw"
                              }
                            >
                              {transaction.type}
                            </span>
                          </td>

                          <td className="amount-cell">
                            {formatMoney(transaction.amount)}
                          </td>

                          <td>{transaction.description || "—"}</td>
                          <td>{transaction.status}</td>
                          <td>{formatDate(transaction.createdAt)}</td>

                        </tr>
                      ))}
                    </tbody>

                  </table>
                </div>

              )}

            </section>

          </>

        ) : (

          <section className="dashboard-card">
            <h2>Account information unavailable</h2>

            <p>
              {message ||
                "We could not find an account linked to this user."}
            </p>

            <button
              className="refresh-button"
              onClick={loadDashboard}
              disabled={dashboardLoading}
            >
              Try again
            </button>
          </section>

        )}

        <footer className="dashboard-footer">
          BALANCEVAULT · SECURE FINANCIAL DEMO
        </footer>

      </main>
    );
  }

  // LOGIN AND REGISTRATION PAGE
  return (
    <main className="auth-page">

      <section className="auth-visual">

        <div className="brand">
          <span className="brand-icon">B</span>
          <span>BalanceVault</span>
        </div>

        <div className="visual-content">

          <span className="eyebrow">
            SMARTER MONEY MANAGEMENT
          </span>

          <h1>
            Your money.
            <br />
            Your control.
          </h1>

          <p>
            Experience secure, transparent and reliable
            digital money management with BalanceVault.
          </p>

          <div className="feature-list">
            <div>✓ Secure account access</div>
            <div>✓ Reliable money transactions</div>
            <div>✓ Transparent transaction records</div>
          </div>

        </div>

        <p className="visual-footer">
          BALANCEVAULT · SECURE FINANCIAL DEMO
        </p>

      </section>

      <section className="auth-panel">

        <div className="auth-box">

          <span className="eyebrow">
            WELCOME TO BALANCEVAULT
          </span>

          <h2>
            {mode === "login"
              ? "Welcome back"
              : "Create your account"}
          </h2>

          <p className="auth-description">
            {mode === "login"
              ? "Sign in to access your secure account."
              : "Register to get started with BalanceVault."}
          </p>

          <div className="mode-switch">

            <button
              type="button"
              className={mode === "login" ? "active" : ""}
              onClick={() => {
                setMode("login");
                setMessage("");
              }}
            >
              Login
            </button>

            <button
              type="button"
              className={mode === "register" ? "active" : ""}
              onClick={() => {
                setMode("register");
                setMessage("");
              }}
            >
              Register
            </button>

          </div>

          <form onSubmit={handleSubmit}>

            {mode === "register" && (
              <label>
                Full name

                <input
                  name="fullName"
                  type="text"
                  placeholder="Enter your full name"
                  value={form.fullName}
                  onChange={handleChange}
                  required
                />
              </label>
            )}

            <label>
              Email address

              <input
                name="email"
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={handleChange}
                required
              />
            </label>

            <label>
              Password

              <input
                name="password"
                type="password"
                placeholder="Enter your password"
                value={form.password}
                onChange={handleChange}
                minLength={8}
                required
              />
            </label>

            {message && (
              <div
                className={`message ${messageType}`}
                role="status"
              >
                {message}
              </div>
            )}

            <button
              className="primary-button"
              type="submit"
              disabled={loading}
            >
              {loading
                ? "Please wait..."
                : mode === "login"
                  ? "Sign in"
                  : "Create account"}
            </button>

          </form>

          <p className="security-note">
            🔒 Your account access is protected with JWT authentication.
          </p>

        </div>

      </section>

    </main>
  );
}

export default App;
