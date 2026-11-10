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
