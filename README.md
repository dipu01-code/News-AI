# Space Explorer 🚀

A modern web application for exploring space-related information, including real-time ISS tracking, astronaut data, space news, and AI-powered chat assistance.

## Features

- **🛰️ ISS Tracking** - Real-time International Space Station location and details
- **👨‍🚀 Astronaut Information** - Browse current and past astronauts in space
- **📰 Space News** - Latest news and updates from the space industry
- **💬 AI Chat** - Interactive chat for space-related queries and discussions
- **📱 Responsive Design** - Works seamlessly on desktop and mobile devices

## Project Structure

```
├── src/
│   ├── App.jsx              # Main application component
│   ├── main.jsx             # React entry point
│   ├── styles.css           # Global styles
│   └── utils.js             # Utility functions
├── api/
│   ├── astros.js            # Astronaut API endpoint
│   ├── chat.js              # Chat API endpoint
│   ├── iss-now.js           # ISS tracking API endpoint
│   └── news.js              # Space news API endpoint
├── public/                  # Static assets
├── index.html               # HTML template
├── package.json             # Project dependencies
├── vite.config.js           # Vite configuration
└── vercel.json              # Deployment configuration
```

## Technologies Used

- **Frontend**: React + Vite
- **Styling**: CSS
- **Backend**: Serverless functions (Vercel)
- **APIs**: 
  - ISS tracking API
  - Space news API
  - Custom chat service
  - Astronaut data API

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd "endsem final project"
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env.local` file with required API keys:
```
VITE_API_KEY=<your-api-key>
```

### Development

Run the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:5173`

### Building

Build for production:
```bash
npm run build
```

Preview the production build:
```bash
npm run preview
```

## API Endpoints

### ISS Now
- **File**: `api/iss-now.js`
- **Purpose**: Get real-time ISS location data

### Astronauts
- **File**: `api/astros.js`
- **Purpose**: Retrieve information about astronauts in space

### Space News
- **File**: `api/news.js`
- **Purpose**: Fetch latest space news and updates

### Chat
- **File**: `api/chat.js`
- **Purpose**: AI-powered chat for space queries

## Deployment

The project is configured for deployment on Vercel. Push to your repository and Vercel will automatically deploy the application.

```bash
npm run build
vercel deploy
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support, email support@spaceexplorer.com or open an issue in the repository.

---

**Made with ❤️ for space enthusiasts**
