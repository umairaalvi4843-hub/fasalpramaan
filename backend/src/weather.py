"""
Open-Meteo weather API integration for FasalPramaan
Fetches real rainfall, temperature data from ERA5
"""

import requests
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class WeatherAnalyzer:
    """Fetches and analyzes weather data from Open-Meteo"""
    
    ERA5_URL = "https://archive-api.open-meteo.com/v1/era5"
    FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
    
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'FasalPramaan/1.0'
        })
        self.timeout_seconds = 30
    
    def get_complete_weather_data(
        self,
        latitude: float,
        longitude: float,
        start_date: str,
        end_date: str
    ) -> Dict:
        """
        Fetch real weather data from ERA5 reanalysis
        """
        logger.info(f"🌤️ Fetching REAL weather data for {latitude}, {longitude} ({start_date} to {end_date})")
        
        try:
            # Fetch from ERA5
            params = {
                "latitude": latitude,
                "longitude": longitude,
                "daily": "precipitation_sum,temperature_2m_max,temperature_2m_min,temperature_2m_mean",
                "timezone": "Asia/Kolkata",
                "start_date": start_date,
                "end_date": end_date
            }
            
            response = self._safe_request(self.ERA5_URL, params)
            
            if response is None:
                logger.warning("⚠️ No response from ERA5 API, using mock data")
                return self._get_mock_data()
            
            data = response.json()
            
            if "daily" in data and data["daily"].get("precipitation_sum"):
                daily = data["daily"]
                precip = daily.get("precipitation_sum", [])
                
                # Check if we have real data
                if precip and any(p is not None and p > 0 for p in precip[:10]):
                    logger.info(f"✅ REAL weather data found: {len(precip)} days")
                    return self._process_real_data(daily, latitude, longitude)
                else:
                    logger.warning("⚠️ No precipitation data found")
                    return self._get_mock_data()
            else:
                logger.warning("⚠️ No daily data in response")
                return self._get_mock_data()
                
        except Exception as e:
            logger.error(f"❌ Error fetching weather: {e}")
            return self._get_mock_data()
    
    def _safe_request(self, url: str, params: Dict, retries: int = 2) -> Optional[requests.Response]:
        """Safely make a request with timeout and retries"""
        for attempt in range(retries):
            try:
                response = self.session.get(url, params=params, timeout=self.timeout_seconds)
                response.raise_for_status()
                return response
            except requests.exceptions.Timeout:
                logger.warning(f"⏱️ Request timeout after {self.timeout_seconds}s (attempt {attempt + 1}/{retries})")
                if attempt < retries - 1:
                    continue
                return None
            except requests.exceptions.RequestException as e:
                logger.warning(f"⚠️ Request failed: {e} (attempt {attempt + 1}/{retries})")
                if attempt < retries - 1:
                    continue
                return None
            except Exception as e:
                logger.error(f"❌ Unexpected error: {e}")
                return None
        return None
    
    def _process_real_data(self, daily: Dict, latitude: float, longitude: float) -> Dict:
        """Process real weather data into the expected format"""
        precip = daily.get("precipitation_sum", [])
        temp_max = daily.get("temperature_2m_max", [])
        temp_min = daily.get("temperature_2m_min", [])
        temp_mean = daily.get("temperature_2m_mean", [])
        
        # Calculate statistics with safe handling
        valid_precip = [p for p in precip if p is not None]
        total_rainfall = sum(valid_precip) if valid_precip else 0
        rainy_days = len([p for p in valid_precip if p > 0.1])
        
        # Temperature stats
        valid_max = [t for t in temp_max if t is not None]
        valid_min = [t for t in temp_min if t is not None]
        valid_mean = [t for t in temp_mean if t is not None]
        
        max_temp = max(valid_max) if valid_max else 0
        min_temp = min(valid_min) if valid_min else 0
        avg_temp = sum(valid_mean) / len(valid_mean) if valid_mean else 0
        
        # Get historical average for comparison
        historical_avg = self._get_historical_average(latitude, longitude)
        
        # Calculate percentage difference
        diff_percent = ((total_rainfall - historical_avg) / historical_avg * 100) if historical_avg > 0 else 0
        
        # Generate comparison text
        comparison = self._generate_comparison(diff_percent)
        
        # Weather summary
        weather_summary = self._generate_weather_summary(precip, temp_max)
        
        logger.info(f"📊 REAL DATA: {total_rainfall:.1f}mm rainfall, {rainy_days} rainy days")
        logger.info(f"📊 Comparison: {comparison}")
        
        return {
            "total_rainfall": total_rainfall,
            "rainy_days": rainy_days,
            "max_temperature": max_temp,
            "min_temperature": min_temp,
            "avg_temperature": avg_temp,
            "historical_avg_rainfall": historical_avg,
            "comparison": comparison,
            "weather_summary": weather_summary,
            "daily_data": daily,
            "data_source": "ERA5-Land (REAL DATA ✅)",
            "message": "Weather data from ERA5-Land reanalysis"
        }
    
    def _generate_comparison(self, diff_percent: float) -> str:
        """Generate comparison text based on percentage difference"""
        abs_diff = abs(diff_percent)
        
        if diff_percent < -50:
            return f"⚠️ Extreme rainfall deficit: {abs_diff:.0f}% below normal (severe drought)"
        elif diff_percent < -30:
            return f"⚠️ Significant rainfall deficit: {abs_diff:.0f}% below normal (drought)"
        elif diff_percent < -15:
            return f"⚠️ Moderate rainfall deficit: {abs_diff:.0f}% below normal"
        elif diff_percent < -5:
            return f"⚠️ Slight rainfall deficit: {abs_diff:.0f}% below normal"
        elif diff_percent < 5:
            return f"✅ Near normal rainfall ({abs_diff:.0f}% difference)"
        elif diff_percent < 15:
            return f"✅ Above normal rainfall: {diff_percent:.0f}% above normal"
        elif diff_percent < 30:
            return f"⚠️ Significantly above normal: {diff_percent:.0f}% above normal"
        else:
            return f"⚠️ Extreme rainfall surplus: {diff_percent:.0f}% above normal"
    
    def _generate_weather_summary(self, precip: List[float], temp_max: List[float]) -> str:
        """Generate a weather summary"""
        if not precip:
            return "Weather data not available"
        
        valid_precip = [p for p in precip if p is not None]
        total = sum(valid_precip) if valid_precip else 0
        rainy = len([p for p in valid_precip if p > 0.1])
        total_days = len(valid_precip)
        
        if temp_max:
            valid_temp = [t for t in temp_max if t is not None]
            if valid_temp:
                avg_temp = sum(valid_temp) / len(valid_temp)
                return f"Total rainfall: {total:.1f}mm over {rainy} days. Avg max temp: {avg_temp:.1f}°C"
        
        return f"Total rainfall: {total:.1f}mm over {rainy} days"
    
    def _get_historical_average(self, latitude: float, longitude: float) -> float:
        """Get regional historical rainfall average"""
        # Haryana region
        if 28.0 < latitude < 30.5 and 74.0 < longitude < 77.5:
            return 210.0
        # Punjab region
        elif 29.5 < latitude < 32.5 and 73.5 < longitude < 76.5:
            return 180.0
        # Uttar Pradesh
        elif 24.0 < latitude < 29.0 and 77.0 < longitude < 84.0:
            return 250.0
        # Default
        return 200.0
    
    def _get_mock_data(self) -> Dict:
        """Return mock data as fallback"""
        logger.warning("⚠️ Using MOCK weather data")
        return {
            "total_rainfall": 125.4,
            "rainy_days": 8,
            "max_temperature": 38.5,
            "min_temperature": 24.2,
            "avg_temperature": 31.3,
            "historical_avg_rainfall": 210.0,
            "comparison": "⚠️ Significant rainfall deficit: 40% below normal (drought) [MOCK]",
            "weather_summary": "Rainfall: 125.4mm over 8 days [MOCK]",
            "daily_data": {},
            "data_source": "MOCK DATA",
            "message": "⚠️ Using mock weather data"
        }