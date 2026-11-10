## Getting Started

Follow these steps to clone the repository and set up KostKita on your local machine.

### 1. Prerequisites

Make sure you have installed the following tools:

- [Git](https://git-scm.com/)
- [Go](https://go.dev/dl/)
- [Node.js](https://nodejs.org/)
- [PostgreSQL](https://www.postgresql.org/)

### 2. Clone the Repository

Open your terminal and run:

```bash
git clone https://github.com/rezaysya/kostkita.git
```

### 3. Navigate to the Project Directory

```bash
cd kostkita
```

### 4. Project Structure

The repository contains two main application directories:

```text
kostkita/
├── backend/       # Go REST API
└── frontend-v2/   # Next.js frontend
```

### 5. Backend Setup

Navigate to the backend directory:

```bash
cd backend
```

Install Go dependencies:

```bash
go mod download
```

Configure your PostgreSQL database and the backend environment variables according to your local setup.

Run the backend:

```bash
go run ./cmd/api
```

The API server will run at:

```text
http://localhost:8080
```

### 6. Frontend Setup

Open another terminal and navigate to the frontend directory:

```bash
cd kostkita/frontend-v2
```

Install dependencies:

```bash
npm install
```

Configure the frontend environment variables to point to your local backend API.

Run the development server:

```bash
npm run dev
```

The frontend will be available at:

```text
http://localhost:3000
```

### 7. Start Developing

Once both the backend and frontend are running, open `http://localhost:3000` in your browser to access KostKita.

Happy coding! 🚀

## Database Setup & Environment Configuration

KostKita uses PostgreSQL as its primary database.

### 1. Create a PostgreSQL Database

Make sure PostgreSQL is running on your machine.

Open PostgreSQL terminal (`psql`) and execute:

```sql
CREATE USER kostkita_user WITH PASSWORD 'your_password';

CREATE DATABASE kostkita OWNER kostkita_user;
```

Replace `your_password` with your own database password.

### 2. Configure Backend Environment

Navigate to the backend directory:

```bash
cd backend
```

Create your local environment configuration file based on the project's example configuration, if available:

```bash
cp .env.example .env
```

Update the database connection settings to match your local PostgreSQL configuration:

- Host: `localhost`
- Port: `5432`
- Database: `kostkita`
- Username: `kostkita_user`
- Password: Your PostgreSQL password

**Important:** Never commit your `.env` file or expose database credentials in a public repository.

### 3. Run Database Migrations

Install the [golang-migrate CLI](https://github.com/golang-migrate/migrate) if it is not already installed.

From the backend directory, run:

```bash
migrate -path migrations -database "YOUR_DATABASE_CONNECTION_STRING" up
```

Replace `YOUR_DATABASE_CONNECTION_STRING` with your PostgreSQL connection string.

Example format:

```text
postgres://kostkita_user:your_password@localhost:5432/kostkita?sslmode=disable
```

This will create the required database tables and relationships.

### 4. Run the Backend

From the `backend` directory:

```bash
go mod download
go run ./cmd/api
```

The API server will be available at:

```text
http://localhost:8080
```

You can verify the server using the health endpoint:

```text
http://localhost:8080/health
```

### 5. Configure the Frontend

Open another terminal and navigate to the frontend directory:

```bash
cd frontend-v2
```

Install dependencies:

```bash
npm install
```

Configure the frontend environment variable to point to the backend API:

```env
API_URL=http://localhost:8080/api/v1
```

Make sure this configuration is saved in the appropriate local environment file used by the frontend.

### 6. Run the Frontend

Start the Next.js development server:

```bash
npm run dev
```

The frontend will be available at:

```text
http://localhost:3000
```

### 7. Access KostKita

Once both servers are running, open your browser and visit:

```text
http://localhost:3000
```

You can now explore the KostKita application locally.

---

**Note:** Make sure the backend and frontend are both running before using the application.
