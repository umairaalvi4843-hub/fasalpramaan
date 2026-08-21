from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import date

class PlotRequest(BaseModel):
    latitude: float
    longitude: float
    start_date: str
    end_date: str
    crop: Optional[str] = None
    name: Optional[str] = None

class NDVIPoint(BaseModel):
    date: str
    ndvi: float
    cloud_cover: float

class AnalysisResult(BaseModel):
    plot_id: str
    plot_name: str
    latitude: float
    longitude: float
    crop: str
    season: str
    
    # NDVI results
    current_ndvi_values: List[float]
    current_dates: List[str]
    historical_ndvi_values: List[List[float]]
    historical_dates: List[List[str]]
    
    # Deviation
    deviation_score: float
    deviation_description: str
    
    # Weather
    rainfall_total: float
    rainfall_days: int
    rainfall_comparison: str
    
    # Status
    status: str  # "anomaly_detected" or "normal"
    status_description: str
    summary: str
    appeal_text: str
    
    # Metadata
    image_count: int
    cloud_cover_avg: float