# FasalPramaan

### Independent Crop Insurance Verification Tool

## Overview

FasalPramaan is a web application that helps farmers independently verify crop insurance assessments using satellite imagery and weather data. It addresses the growing need for transparency in India's PMFBY crop insurance scheme, which covers over 4.19 crore farmers.

## The Problem

With the shift toward YES-TECH (remote sensing-based yield estimation), farmers often have no way to independently verify the data used to assess their claims. In 2017 alone, an insurance company rejected ₹390 crore worth of claims in Haryana using satellite evidence that farmers couldn't access or verify.

FasalPramaan changes this by giving farmers access to the same data sources used in official assessments, presented in an understandable format.

## Key Features

- 🌍 **Interactive Map** — Select from documented cases across India
- 📈 **NDVI Time Series** — Visualize vegetation health over time, with a time-lapse animation of NDVI progression
- 📊 **Deviation Score** — Statistical comparison (in standard deviations) with historical baselines, not an AI confidence score
- 💧 **Weather Analysis** — Real rainfall, temperature and humidity data from Open-Meteo ERA5-Land
- 📄 **Appeal Generator** — Professional appeal documents ready for filing, exportable as PDF, Word, or HTML
- 🔀 **Compare Feature** — Side-by-side analysis of two plots, with automated insights and a recommendation
- 💬 **AI Assistant** — Chatbot that answers questions about NDVI, crop stress, and appeals, aware of whichever plot is currently open, powered by a Hugging Face model with a fallback
- 📋 **Stat Dashboard** — At-a-glance view of deviation, rainfall, temperature, humidity, data points, and vegetation status

## Technology Stack

### Backend
- FastAPI (Python)
- Google Earth Engine API
- Open-Meteo Weather API
- ReportLab (PDF generation)
- python-docx (Word document generation)

### AI
- Hugging Face Inference API (chatbot responses, context-aware of the selected plot's data, with a fallback if the API is unavailable)

### Frontend
- React
- Vite
- Leaflet (Interactive maps)
- Chart.js (NDVI visualizations)

### Deployment
- Render (Backend)
- Vercel (Frontend)

## Live Demo

- Frontend: https://fasalpramaan.vercel.app
- Backend API: https://fasalpramaan-backend.onrender.com

## Demo Cases

The application includes four documented cases:

| Case | Crop | Year | District | State |
|---|---|---|---|---|
| Sirsa Cotton | Cotton | 2017 | Sirsa | Haryana |
| Bhiwani Bajra | Bajra | 2017 | Bhiwani | Haryana |
| Vidarbha Cotton | Cotton | 2018-19 | Wardha | Maharashtra |
| Mandya Paddy | Paddy | 2021 | Mandya | Karnataka |

## How It Works

1. **Select a Plot** — Click on a marker or button to select a demo case
2. **Analysis Runs** — Satellite and weather data are fetched and processed
3. **View Results** — NDVI charts, deviation scores, and weather data are displayed
4. **Ask the Assistant** — Use the chatbot for plain-language answers about the results
5. **Download Appeal** — Generate a professional appeal document in PDF, Word, or HTML

## Local Development

### Prerequisites
- Python 3.11+
- Node.js 18+
- Google Earth Engine account
- Hugging Face API key (optional, chatbot falls back gracefully without one)

### Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python run.py
```

The backend reads configuration (Earth Engine credentials, Hugging Face API key) from environment variables. Copy `.env.example` to `.env` and fill in your own keys before running locally; no keys are committed to this repository.

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The frontend expects the backend API URL in a `.env` file (see `.env.example`). By default it points to the local backend at `http://localhost:8000`; update it to the deployed Render URL if you're pointing the local frontend at production.

## Security & Scalability Notes

- **Secrets**: No API keys, credentials, or `.env` files are committed to this repository. Local development and deployment both read secrets from environment variables.
- **Data sources**: Sentinel-2 (Google Earth Engine) and Open-Meteo are both free, public, national/global-coverage sources, so the same pipeline extends to new crops, states, or seasons without additional licensing cost.
- **Stateless backend**: The FastAPI service does not persist farmer data between requests, which keeps it simple to scale horizontally on Render if usage grows.
- **CORS**: The backend restricts cross-origin requests to the deployed frontend domain.
- **Known limitation**: Optical satellite imagery (Sentinel-2) is affected by monsoon cloud cover, which is often exactly when crop damage claims occur. A Sentinel-1 radar fallback is on the roadmap to address this.
- **Free-tier deployment**: The backend runs on Render's free tier, which can cold-start after inactivity. This is a known trade-off for a hackathon-stage deployment, not a production configuration.
