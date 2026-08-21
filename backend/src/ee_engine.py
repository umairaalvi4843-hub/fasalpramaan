"""
Earth Engine integration for FasalPramaan
Handles Sentinel-2 imagery, NDVI calculation, and time series analysis
"""

import ee
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Optional
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Earth Engine
try:
    ee.Initialize(project='fasalpramaan-earth-engine')
    logger.info("✅ Earth Engine initialized successfully")
except Exception as e:
    logger.error(f"❌ Failed to initialize Earth Engine: {e}")
    logger.info("⚠️  Running in mock mode (EE not available)")
    EE_AVAILABLE = False
else:
    EE_AVAILABLE = True


class EarthEngineAnalyzer:
    """Main class for Earth Engine operations"""
    
    def __init__(self):
        self.sentinel2 = ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
        self.landsat = ee.ImageCollection("LANDSAT/LC09/C02/T1_L2")
        
    def get_ndvi_time_series(
        self, 
        latitude: float, 
        longitude: float, 
        start_date: str, 
        end_date: str,
        max_cloud_cover: float = 30
    ) -> Dict:
        """
        Get NDVI time series for a specific location and date range.
        """
        if not EE_AVAILABLE:
            return self._get_mock_ndvi_data(start_date, end_date)
            
        try:
            point = ee.Geometry.Point([longitude, latitude])
            
            # Try Sentinel-2 first
            collection = (self.sentinel2
                .filterBounds(point)
                .filterDate(start_date, end_date)
                .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', max_cloud_cover))
                .sort('CLOUDY_PIXEL_PERCENTAGE'))
            
            image_count = collection.size().getInfo()
            logger.info(f"Found {image_count} Sentinel-2 images")
            
            if image_count == 0:
                # Fallback to Landsat
                collection = (self.landsat
                    .filterBounds(point)
                    .filterDate(start_date, end_date)
                    .filter(ee.Filter.lt('CLOUD_COVER', max_cloud_cover))
                    .sort('CLOUD_COVER'))
                image_count = collection.size().getInfo()
                logger.info(f"Found {image_count} Landsat images")
                
            if image_count == 0:
                return {
                    "dates": [],
                    "ndvi_values": [],
                    "cloud_cover": [],
                    "message": "No cloud-free imagery available"
                }
            
            # Calculate NDVI for each image
            def calculate_ndvi(image):
                # Sentinel-2: B8 (NIR), B4 (Red)
                # Landsat: SR_B5 (NIR), SR_B4 (Red)
                nir = image.select('B8')
                red = image.select('B4')
                ndvi = nir.subtract(red).divide(nir.add(red)).rename('NDVI')
                return image.addBands(ndvi).set('date', image.date().format())
            
            ndvi_collection = collection.map(calculate_ndvi)
            
            # Extract data points
            dates = []
            ndvi_values = []
            cloud_covers = []
            
            ndvi_list = ndvi_collection.toList(ndvi_collection.size())
            
            for i in range(min(image_count, 30)):  # Limit to 30 images
                image = ee.Image(ndvi_list.get(i))
                ndvi_point = image.select('NDVI').reduceRegion(
                    reducer=ee.Reducer.mean(),
                    geometry=point,
                    scale=20,
                    maxPixels=1e9
                )
                
                ndvi_val = ndvi_point.get('NDVI').getInfo()
                
                if ndvi_val is not None and not np.isnan(ndvi_val):
                    date_str = image.date().format().getInfo()[:10]
                    cloud = image.get('CLOUDY_PIXEL_PERCENTAGE').getInfo() if 'CLOUDY_PIXEL_PERCENTAGE' in image.getInfo() else 0
                    
                    dates.append(date_str)
                    ndvi_values.append(float(ndvi_val))
                    cloud_covers.append(float(cloud))
            
            return {
                "dates": dates,
                "ndvi_values": ndvi_values,
                "cloud_cover": cloud_covers,
                "image_count": len(dates),
                "message": f"Extracted {len(dates)} data points"
            }
            
        except Exception as e:
            logger.error(f"Error in get_ndvi_time_series: {e}")
            return self._get_mock_ndvi_data(start_date, end_date)

    def get_historical_baseline(
        self, 
        latitude: float, 
        longitude: float, 
        current_season_start: str,
        current_season_end: str,
        num_prior_seasons: int = 2
    ) -> Dict:
        """
        Get historical NDVI baseline for comparison.
        """
        start = datetime.fromisoformat(current_season_start)
        end = datetime.fromisoformat(current_season_end)
        
        historical_data = []
        historical_dates = []
        
        for year_offset in range(1, num_prior_seasons + 1):
            season_start = start.replace(year=start.year - year_offset)
            season_end = end.replace(year=end.year - year_offset)
            
            if season_start > season_end:
                season_start = season_start.replace(year=season_start.year - 1)
            
            start_str = season_start.strftime("%Y-%m-%d")
            end_str = season_end.strftime("%Y-%m-%d")
            
            logger.info(f"Fetching season {year_offset} prior: {start_str} to {end_str}")
            
            result = self.get_ndvi_time_series(
                latitude, longitude, start_str, end_str
            )
            
            if result.get('ndvi_values'):
                historical_data.append(result['ndvi_values'])
                historical_dates.append(result['dates'])
            else:
                # Use mock data if no real data
                mock = self._get_mock_ndvi_data(start_str, end_str)
                historical_data.append(mock['ndvi_values'])
                historical_dates.append(mock['dates'])
        
        return {
            "historical_ndvi": historical_data,
            "historical_dates": historical_dates
        }

    def _get_mock_ndvi_data(self, start_date: str, end_date: str) -> Dict:
        """Generate mock NDVI data for testing."""
        dates = []
        ndvi_values = []
        
        start = datetime.fromisoformat(start_date)
        end = datetime.fromisoformat(end_date)
        
        # Generate weekly data points
        current = start
        while current <= end:
            dates.append(current.strftime("%Y-%m-%d"))
            # Healthy crops: NDVI 0.4-0.8, stressed: 0.2-0.4
            ndvi = 0.5 + 0.15 * np.sin(np.random.rand() * 2 * np.pi)
            ndvi_values.append(float(ndvi))
            current += timedelta(days=7)
        
        return {
            "dates": dates,
            "ndvi_values": ndvi_values,
            "cloud_cover": [10] * len(dates),
            "image_count": len(dates),
            "message": "Mock data generated"
        }