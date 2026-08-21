"""
Earth Engine integration for FasalPramaan
Handles Sentinel-2 imagery, NDVI calculation, and time series analysis
With caching to reduce latency
"""

import ee
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Optional
import logging
import time
import hashlib
import json
import os

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Earth Engine
EE_AVAILABLE = False
try:
    ee.Initialize(project='fasalpramaan-earth-engine')
    EE_AVAILABLE = True
    logger.info("✅ Earth Engine initialized successfully")
except Exception as e:
    logger.warning(f"⚠️ Earth Engine not available: {e}")

# Cache directory
CACHE_DIR = os.path.join(os.path.dirname(__file__), '..', 'data', 'cache')
os.makedirs(CACHE_DIR, exist_ok=True)

# Earth Engine timeout
EARTH_ENGINE_TIMEOUT = 8


class EarthEngineAnalyzer:
    """Main class for Earth Engine operations with caching"""
    
    def __init__(self):
        self.sentinel2 = ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
        self.landsat = ee.ImageCollection("LANDSAT/LC09/C02/T1_L2")
    
    def _get_cache_key(self, latitude: float, longitude: float, start_date: str, end_date: str) -> str:
        """Generate a unique cache key for a query"""
        key = f"{latitude}_{longitude}_{start_date}_{end_date}"
        return hashlib.md5(key.encode()).hexdigest()
    
    def _get_cached_result(self, cache_key: str) -> Optional[Dict]:
        """Get cached result if it exists and is recent (< 24 hours)"""
        cache_file = os.path.join(CACHE_DIR, f"{cache_key}.json")
        if os.path.exists(cache_file):
            try:
                with open(cache_file, 'r') as f:
                    data = json.load(f)
                # Check if cache is less than 24 hours old
                cache_time = datetime.fromisoformat(data.get('_cache_time', '2000-01-01T00:00:00'))
                if (datetime.now() - cache_time).total_seconds() < 86400:  # 24 hours
                    logger.info(f"✅ Cache hit for {cache_key}")
                    return data.get('result')
            except Exception as e:
                logger.warning(f"Cache read failed: {e}")
        return None
    
    def _save_to_cache(self, cache_key: str, result: Dict):
        """Save result to cache"""
        cache_file = os.path.join(CACHE_DIR, f"{cache_key}.json")
        try:
            data = {
                '_cache_time': datetime.now().isoformat(),
                'result': result
            }
            with open(cache_file, 'w') as f:
                json.dump(data, f)
            logger.info(f"💾 Cached result for {cache_key}")
        except Exception as e:
            logger.warning(f"Cache write failed: {e}")
    
    def get_ndvi_time_series(
        self, 
        latitude: float, 
        longitude: float, 
        start_date: str, 
        end_date: str,
        max_cloud_cover: float = 20
    ) -> Dict:
        """
        Get NDVI time series with caching.
        """
        # Check cache first
        cache_key = self._get_cache_key(latitude, longitude, start_date, end_date)
        cached = self._get_cached_result(cache_key)
        if cached:
            return cached
        
        if not EE_AVAILABLE:
            return self._get_empty_response("Earth Engine not available")
        
        try:
            point = ee.Geometry.Point([longitude, latitude])
            
            # Build collections
            sentinel_collection = (self.sentinel2
                .filterBounds(point)
                .filterDate(start_date, end_date)
                .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', max_cloud_cover)))
            
            # Check Sentinel-2 count with timeout
            sentinel_count = self._get_count_with_timeout(sentinel_collection)
            logger.info(f"Found {sentinel_count} Sentinel-2 images")
            
            if sentinel_count > 0:
                result = self._process_collection(sentinel_collection, point, sentinel_count, "Sentinel-2")
                self._save_to_cache(cache_key, result)
                return result
            
            # Try Landsat
            landsat_collection = (self.landsat
                .filterBounds(point)
                .filterDate(start_date, end_date)
                .filter(ee.Filter.lt('CLOUD_COVER', max_cloud_cover)))
            
            landsat_count = self._get_count_with_timeout(landsat_collection)
            logger.info(f"Found {landsat_count} Landsat images")
            
            if landsat_count > 0:
                result = self._process_collection(landsat_collection, point, landsat_count, "Landsat")
                self._save_to_cache(cache_key, result)
                return result
            
            result = self._get_empty_response("No cloud-free imagery available")
            self._save_to_cache(cache_key, result)
            return result
                
        except Exception as e:
            logger.error(f"Error in get_ndvi_time_series: {e}")
            result = self._get_empty_response(str(e))
            self._save_to_cache(cache_key, result)
            return result
    
    def _get_count_with_timeout(self, collection) -> int:
        """Get collection size with timeout"""
        try:
            import threading
            result = [None]
            error = [None]
            
            def target():
                try:
                    result[0] = collection.size().getInfo()
                except Exception as e:
                    error[0] = e
            
            thread = threading.Thread(target=target)
            thread.start()
            thread.join(timeout=EARTH_ENGINE_TIMEOUT)
            
            if thread.is_alive():
                logger.warning("⏱️ Count check timed out")
                return 0
            
            if error[0]:
                raise error[0]
            
            return result[0] if result[0] is not None else 0
            
        except Exception as e:
            logger.warning(f"Count check failed: {e}")
            return 0
    
    def _process_collection(self, collection, point, count: int, source: str) -> Dict:
        """Process images from a collection - optimized"""
        try:
            dates = []
            ndvi_values = []
            cloud_covers = []
            
            # Only process up to 10 images
            limit = min(count, 10)
            ndvi_list = collection.toList(limit)
            
            for i in range(limit):
                try:
                    img = ee.Image(ndvi_list.get(i))
                    
                    # Calculate NDVI
                    if source == "Sentinel-2":
                        nir = img.select('B8')
                        red = img.select('B4')
                        cloud = img.get('CLOUDY_PIXEL_PERCENTAGE')
                    else:  # Landsat
                        nir = img.select('SR_B5')
                        red = img.select('SR_B4')
                        cloud = img.get('CLOUD_COVER')
                    
                    ndvi = nir.subtract(red).divide(nir.add(red)).rename('NDVI')
                    ndvi_img = img.addBands(ndvi)
                    
                    # Extract NDVI at point
                    ndvi_point = ndvi_img.select('NDVI').reduceRegion(
                        reducer=ee.Reducer.mean(),
                        geometry=point,
                        scale=20,
                        maxPixels=1e9
                    )
                    
                    val = self._get_value_with_timeout(ndvi_point.get('NDVI'))
                    
                    if val is not None and not np.isnan(val):
                        date_str = self._get_value_with_timeout(img.date().format())
                        cloud_val = self._get_value_with_timeout(cloud)
                        
                        if date_str:
                            dates.append(date_str[:10])
                            ndvi_values.append(float(val))
                            cloud_covers.append(float(cloud_val) if cloud_val else 0)
                            
                except Exception as e:
                    logger.warning(f"Skipping image {i}: {e}")
                    continue
            
            if dates:
                logger.info(f"✅ Extracted {len(dates)} NDVI points from {source}")
                return {
                    "dates": dates,
                    "ndvi_values": ndvi_values,
                    "cloud_cover": cloud_covers,
                    "image_count": len(dates),
                    "message": f"Extracted {len(dates)} data points from {source}"
                }
            else:
                return self._get_empty_response("No valid NDVI values extracted")
                
        except Exception as e:
            logger.error(f"Processing failed: {e}")
            return self._get_empty_response(str(e))
    
    def _get_value_with_timeout(self, ee_object, default=None):
        """Get a value from Earth Engine with timeout"""
        try:
            import threading
            result = [None]
            error = [None]
            
            def target():
                try:
                    result[0] = ee_object.getInfo()
                except Exception as e:
                    error[0] = e
            
            thread = threading.Thread(target=target)
            thread.start()
            thread.join(timeout=EARTH_ENGINE_TIMEOUT)
            
            if thread.is_alive():
                logger.warning("⏱️ getInfo timed out")
                return default
            
            if error[0]:
                raise error[0]
            
            return result[0] if result[0] is not None else default
            
        except Exception as e:
            logger.warning(f"getInfo failed: {e}")
            return default
    
    def get_historical_baseline(
        self, 
        latitude: float, 
        longitude: float, 
        current_season_start: str,
        current_season_end: str,
        num_prior_seasons: int = 2
    ) -> Dict:
        """Get historical NDVI baseline with caching."""
        try:
            start = datetime.fromisoformat(current_season_start)
            end = datetime.fromisoformat(current_season_end)
        except:
            start = datetime.now() - timedelta(days=90)
            end = datetime.now()
        
        historical_ndvi = []
        historical_dates = []
        
        for year_offset in range(1, num_prior_seasons + 1):
            try:
                season_start = start.replace(year=start.year - year_offset)
                season_end = end.replace(year=end.year - year_offset)
                
                if season_start > season_end:
                    season_start = season_start.replace(year=season_start.year - 1)
                
                start_str = season_start.strftime("%Y-%m-%d")
                end_str = season_end.strftime("%Y-%m-%d")
                
                logger.info(f"📊 Fetching season {year_offset} prior")
                
                data = self.get_ndvi_time_series(
                    latitude, longitude, start_str, end_str
                )
                
                if data.get('ndvi_values'):
                    historical_ndvi.append(data['ndvi_values'])
                    historical_dates.append(data['dates'])
                else:
                    historical_ndvi.append([])
                    historical_dates.append([])
                    
            except Exception as e:
                logger.warning(f"Error fetching season {year_offset}: {e}")
                historical_ndvi.append([])
                historical_dates.append([])
        
        return {
            "historical_ndvi": historical_ndvi,
            "historical_dates": historical_dates
        }
    
    def _get_empty_response(self, message: str) -> Dict:
        """Return empty response with message"""
        return {
            "dates": [],
            "ndvi_values": [],
            "cloud_cover": [],
            "image_count": 0,
            "message": message
        }