# Vaultory - AI-Powered Digital Product Ownership & Warranty Management System

**Vaultory** is a full-stack digital asset vault that enables users to maintain cryptographically verifiable ownership records of all their purchased products, including digitized receipts, product specifications, condition baselines, calculated warranty deadlines, and complete repair histories.

---

## 1. Technology Stack

- **Frontend**: React.js (Vite), Tailwind CSS, Lucide React icons, Axios, React Router v7
- **Backend**: Python 3.14, FastAPI, Uvicorn
- **Database & ORM**: PostgreSQL, SQLAlchemy ORM (with automatic resilient fallback)
- **AI & Computer Vision**:
  - **Tesseract OCR**: Extracts text from purchase receipts (images & PDFs)
  - **OpenAI API**: Intelligent structured extraction of product name, brand, model, price, purchase date, retailer, and warranty
  - **OpenCV**: Computer vision comparison between original baseline and current condition photographs (structural difference, ORB feature matching, JET colormap difference heatmaps)
- **Storage & Documents**:
  - **Cloudinary / Local Fallback**: Scalable storage for receipts, condition photos, and invoices
  - **ReportLab**: Generates high-resolution PDF Ownership & Warranty Evidence reports
- **Notifications & Scheduling**:
  - **Telegram Bot API**: Proactive alerts at 30 days, 7 days, and 1 day before expiration
  - **APScheduler**: Automated recurring background scheduler for warranty reminders
  - **JWT**: Secure authentication and user data isolation

---

## 2. 10 Main Application Pages

1. **Login & Registration** (`/login`, `/register`): JWT-authenticated access, password hashing with bcrypt, pre-configured "One-Click Demo Login" (`demo@vaultory.io` / `Password123!`).
2. **Dashboard** (`/dashboard`): Real-time metrics (Total Registered Assets, Portfolio Value, Active Warranties, Expiring Soon, Expired, Repairs Logged), upcoming expiration urgency cards, and recent products table.
3. **My Products** (`/products`): Comprehensive inventory with search by name, model, or retailer; category filter pills (Electronics, Computing, Appliances, etc.); warranty status filter; and quick actions.
4. **Add Product** (`/add-product`):
   - **Tab 1: AI Receipt Scanner**: Upload any receipt image or PDF; runs Tesseract OCR and OpenAI structuring, displaying raw OCR text and pre-populating fields for user review.
   - **Tab 2: Manual Registration**: Detailed product, warranty, receipt, and condition photo baseline entry form.
5. **Product Details** (`/products/:id`): Complete asset view, warranty status, receipt viewer, condition photo gallery with OpenCV comparison launcher, repair log, and one-click PDF generation.
6. **Warranty Management** (`/warranties`): Calculated countdown days, active and expired status badges, and in-place modal editing of coverage scope and duration.
7. **Ownership Timeline** (`/timeline`): Chronological vertical timeline containing:
   - Purchase Details
   - Digitized Receipt Archival
   - Original Condition Photographs
   - Warranty Activation & Expiration Milestones
   - Repair and Service Events
   - Updated Condition Photographs
8. **Repair History** (`/repairs`): Global maintenance log across all products, warranty coverage tracking ($0 liability), out-of-pocket costs, and service invoice uploads.
9. **Telegram Notification Settings** (`/telegram-settings`): Bot connection instructions, Chat ID & Username management, 30d/7d/1d threshold toggles, live "Send Test Telegram Alert" button, and on-demand "Check Expirations Now" trigger.
10. **User Profile** (`/profile`): User identity, legal name for PDF evidence certificates, account stats, and password management.

---

## 3. Project Structure

```
Vaultory/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── deps.py                # JWT Auth dependencies & DB session
│   │   │   └── routers/
│   │   │       ├── auth.py            # User registration & login
│   │   │       ├── products.py        # CRUD for registered assets
│   │   │       ├── warranties.py      # Warranty tracking & stats
│   │   │       ├── condition_photos.py# Photo uploads & OpenCV comparisons
│   │   │       ├── repairs.py         # Repair & service history
│   │   │       ├── timeline.py        # Chronological ownership timeline
│   │   │       ├── evidence.py        # ReportLab PDF report generation
│   │   │       ├── notifications.py   # Telegram alerts & logs
│   │   │       ├── dashboard.py       # Metrics & upcoming expirations
│   │   │       └── ocr.py             # Tesseract OCR & AI receipt scanning
│   │   ├── core/
│   │   │   ├── config.py              # Environment settings
│   │   │   ├── database.py            # SQLAlchemy PostgreSQL connection & engine
│   │   │   └── security.py            # Bcrypt hashing & JWT encoding/decoding
│   │   ├── models/                    # SQLAlchemy ORM models (User, Product, Warranty, etc.)
│   │   ├── schemas/                   # Pydantic validation schemas
│   │   ├── services/
│   │   │   ├── ocr_service.py         # Tesseract OCR extractor
│   │   │   ├── ai_service.py          # OpenAI receipt structuring & heuristic parser
│   │   │   ├── image_comparison_service.py # OpenCV SSIM, ORB matching, and JET heatmaps
│   │   │   ├── cloudinary_service.py  # Cloudinary & local storage provider
│   │   │   ├── pdf_service.py         # ReportLab Ownership Evidence PDF builder
│   │   │   ├── telegram_service.py    # Telegram Bot API client
│   │   │   └── scheduler_service.py   # APScheduler warranty notification runner
│   │   ├── uploads/                   # Local storage for receipts & photos
│   │   └── main.py                    # FastAPI entrypoint
│   ├── .env                           # Environment configuration
│   ├── requirements.txt               # Backend dependencies
│   ├── seed_data.py                   # Sample data seeder
│   └── test_api_suite.py              # Automated 13-point test suite
├── frontend/
│   ├── src/
│   │   ├── api/client.js              # Axios instance with JWT interceptor
│   │   ├── context/AuthContext.jsx    # Authentication & user state
│   │   ├── components/                # Navbar, Sidebar, Layout, StatCard, StatusBadge, ImageCompareModal
│   │   ├── pages/                     # 10 Application Pages
│   │   ├── App.jsx                    # React Router configuration
│   │   └── index.css                  # Tailwind CSS styling
│   ├── package.json
│   ├── tailwind.config.js
│   └── vite.config.js
├── run_dev.py                         # Simultaneous dev server launcher
└── README.md
```

---

## 4. Getting Started

### Prerequisites
- Python 3.10+ (tested with Python 3.14)
- Node.js 18+ and npm

### Quick Start
1. **Seed Sample Data (Optional)**:
   ```bash
   python backend/seed_data.py
   ```
   *Pre-populates a Demo User (`demo@vaultory.io` / `Password123!`), 3 products (active, expiring soon, expired), condition photos, receipts, and repairs.*

2. **Run Both Backend and Frontend**:
   ```bash
   python run_dev.py
   ```
   - **Backend API**: `http://localhost:8000` (Swagger docs at `http://localhost:8000/docs`)
   - **Frontend App**: `http://localhost:5173`

3. **Or Run Individually**:
   - Backend:
     ```bash
     uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
     ```
   - Frontend:
     ```bash
     cd frontend
     npm run dev
     ```

4. **Run Verification Test Suite**:
   ```bash
   python backend/test_api_suite.py
   ```
   *Executes all 13 core end-to-end API tests and outputs step-by-step verification.*

