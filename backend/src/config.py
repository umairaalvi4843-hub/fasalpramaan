import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    # Earth Engine
    EARTH_ENGINE_PROJECT = os.getenv("EARTH_ENGINE_PROJECT", "fasalpramaan-earth-engine")
    
    # Open-Meteo
    OPEN_METEO_BASE_URL = os.getenv("OPEN_METEO_BASE_URL", "https://api.open-meteo.com/v1/forecast")
    
    # CORS
    ALLOWED_ORIGINS = [
        "http://localhost:3000",
        "http://localhost:5173",
        "https://fasalpramaan.vercel.app",
        "https://*.vercel.app"
    ]
    
    # Demo plots (2017 Haryana dispute)
    DEMO_PLOTS = {
        "sirsa_cotton": {
            "id": "sirsa_cotton",
            "name": "Sirsa Cotton (2017)",
            "latitude": 29.5339,
            "longitude": 75.0284,
            "crop": "cotton",
            "season": "Kharif 2017",
            "damage_period": {"start": "2017-07-01", "end": "2017-09-30"},
            "district": "Sirsa",
            "state": "Haryana"
        },
        "bhiwani_bajra": {
            "id": "bhiwani_bajra",
            "name": "Bhiwani Bajra (2017)",
            "latitude": 28.7931,
            "longitude": 76.1397,
            "crop": "bajra",
            "season": "Kharif 2017",
            "damage_period": {"start": "2017-07-01", "end": "2017-09-30"},
            "district": "Bhiwani",
            "state": "Haryana"
        }
    }

settings = Settings()