# AOL Instant Messenger Clone

A nostalgic recreation of the classic AOL Instant Messenger (AIM) experience using modern web technologies.

## Project Structure

```
aim/
├── frontend/          # React TypeScript frontend with Vite
│   ├── src/
│   │   ├── components/    # React components
│   │   │   ├── auth/      # Authentication components
│   │   │   ├── buddy/     # Buddy list components
│   │   │   ├── chat/      # Chat window components
│   │   │   └── ui/        # Reusable UI components
│   │   ├── services/      # API and socket services
│   │   ├── hooks/         # Custom React hooks
│   │   ├── types/         # TypeScript type definitions
│   │   └── styles/        # CSS modules and styling
│   └── package.json
├── backend/           # Node.js Express backend with TypeScript
│   ├── src/
│   │   ├── models/        # Database models
│   │   ├── services/      # Business logic services
│   │   ├── routes/        # API route handlers
│   │   ├── middleware/    # Express middleware
│   │   └── utils/         # Utility functions
│   └── package.json
└── package.json       # Root package.json for development scripts
```

## Technology Stack

### Frontend
- **React** with TypeScript
- **Vite** for build tooling
- **Socket.io Client** for real-time communication
- **CSS Modules** for authentic AIM styling

### Backend
- **Node.js** with Express
- **TypeScript** for type safety
- **Socket.io** for WebSocket connections
- **SQLite** for database (development)
- **JWT** for authentication
- **bcryptjs** for password hashing

## Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm

### Installation

1. Install all dependencies:
```bash
npm run install:all
```

2. Set up environment variables:
```bash
# Copy example environment files
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

3. Start development servers:
```bash
npm run dev
```

This will start both the frontend (http://localhost:5173) and backend (http://localhost:3001) servers concurrently.

### Available Scripts

- `npm run dev` - Start both frontend and backend in development mode
- `npm run dev:frontend` - Start only the frontend development server
- `npm run dev:backend` - Start only the backend development server
- `npm run build` - Build both frontend and backend for production
- `npm run build:frontend` - Build only the frontend
- `npm run build:backend` - Build only the backend
- `npm start` - Start the production backend server

## Development

The project is set up with:
- Hot reloading for both frontend and backend
- TypeScript compilation and type checking
- Concurrent development server execution
- Proper CORS configuration for local development

## Next Steps

The basic project structure is now ready. The next tasks will involve:
1. Setting up the database models and connection
2. Implementing authentication system
3. Building the frontend components
4. Adding real-time messaging functionality