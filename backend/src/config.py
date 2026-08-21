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
    
    # Demo plots - 4 documented cases across India
    DEMO_PLOTS = {
        "sirsa_cotton": {
            "id": "sirsa_cotton",
            "name": "Sirsa Cotton (2017)",
            "latitude": 29.5339,
            "longitude": 75.0284,
            "crop": "Cotton",
            "season": "Kharif 2017",
            "damage_period": {"start": "2017-07-01", "end": "2017-09-30"},
            "district": "Sirsa",
            "state": "Haryana",
            "description": "Insurance company rejected ₹390 crore cotton claims using satellite evidence",
            "icon": "🌾"
        },
        "bhiwani_bajra": {
            "id": "bhiwani_bajra",
            "name": "Bhiwani Bajra (2017)",
            "latitude": 28.7931,
            "longitude": 76.1397,
            "crop": "Bajra",
            "season": "Kharif 2017",
            "damage_period": {"start": "2017-07-01", "end": "2017-09-30"},
            "district": "Bhiwani",
            "state": "Haryana",
            "description": "Part of ₹390 crore dispute where satellite data was used against farmers",
            "icon": "🌾"
        },
        "vidarbha_cotton": {
            "id": "vidarbha_cotton",
            "name": "Vidarbha Cotton (2018-19)",
            "latitude": 20.7500,
            "longitude": 78.6000,
            "crop": "Cotton",
            "season": "Kharif 2018-19",
            "damage_period": {"start": "2018-08-01", "end": "2018-10-31"},
            "district": "Wardha",
            "state": "Maharashtra",
            "description": "Documented drought in India's cotton belt affecting thousands of farmers",
            "icon": "🌾"
        },
        "mandya_paddy": {
            "id": "mandya_paddy",
            "name": "Mandya Paddy (2021)",
            "latitude": 12.5200,
            "longitude": 76.9000,
            "crop": "Paddy",
            "season": "Kharif 2021",
            "damage_period": {"start": "2021-07-01", "end": "2021-09-30"},
            "district": "Mandya",
            "state": "Karnataka",
            "description": "Paddy is YES-TECH mandatory crop; farmers facing assessment disputes",
            "icon": "🌾"
        }
    }

settings = Settings()