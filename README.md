# 🌾 FasalPramaan

**Independent Crop Insurance Verification Tool**

## Overview

FasalPramaan is a web application that helps farmers independently verify crop insurance assessments using satellite imagery and weather data. It addresses the growing need for transparency in India's PMFBY crop insurance scheme, which covers over 4.19 crore farmers.

## The Problem

With the shift toward YES-TECH (remote sensing-based yield estimation), farmers often have no way to independently verify the data used to assess their claims. In 2017 alone, an insurance company rejected ₹390 crore worth of claims in Haryana using satellite evidence that farmers couldn't access or verify.

FasalPramaan changes this by giving farmers access to the same data sources used in official assessments, presented in an understandable format.

## Key Features

- 🌍 **Interactive Map** — Select from documented cases across India
- 📈 **NDVI Time Series** — Visualize vegetation health over time
- 📊 **Deviation Score** — Statistical comparison with historical baselines
- 💧 **Weather Analysis** — Real rainfall and temperature data
- 📄 **Appeal Generator** — Professional documents ready for filing
- 🔀 **Compare Feature** — Side-by-side analysis of multiple plots
- 💬 **AI Assistant** — Answers questions about NDVI, stress, and appeals

## Technology Stack

### Backend
- FastAPI (Python)
- Google Earth Engine API
- Open-Meteo Weather API
- ReportLab (PDF generation)
- python-docx (Word document generation)

### Frontend
- React
- Vite
- Leaflet (Interactive maps)
- Chart.js (NDVI visualizations)

### Deployment
- Render (Backend)
- Vercel (Frontend)

## Live Demo

- **Frontend:** https://fasalpramaan.vercel.app
- **Backend API:** https://fasalpramaan-backend.onrender.com

## Demo Cases

The application includes four documented cases:

| Case | Crop | Year | District | State |
|------|------|------|----------|-------|
| Sirsa Cotton | Cotton | 2017 | Sirsa | Haryana |
| Bhiwani Bajra | Bajra | 2017 | Bhiwani | Haryana |
| Vidarbha Cotton | Cotton | 2018-19 | Wardha | Maharashtra |
| Mandya Paddy | Paddy | 2021 | Mandya | Karnataka |

## How It Works

1. **Select a Plot** — Click on a marker or button to select a demo case
2. **Analysis Runs** — Satellite and weather data are fetched and processed
3. **View Results** — NDVI charts, deviation scores, and weather data are displayed
4. **Download Appeal** — Generate a professional appeal document in PDF, Word, or HTML

## Local Development

### Prerequisites
- Python 3.11+
- Node.js 18+
- Google Earth Engine account

### Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python run.py
