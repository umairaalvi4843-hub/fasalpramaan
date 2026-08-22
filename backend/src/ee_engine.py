"""
Earth Engine integration for FasalPramaan
"""

import ee
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Optional
import logging
import hashlib
import json
import os
import random
import tempfile

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ============================================
# INITIALIZE EARTH ENGINE
# ============================================

# Try to initialize Earth Engine
try:
    is_render = os.getenv('RENDER') == 'true'
    
    if is_render:
        ccredentials_json = os.getenv('GOOGLE_APPLICATION_CREDENTIALS_JSON')
        if credentials_json:
            key_data = json.loads(credentials_json)
            service_account_email = key_data['client_email']
            credentials = ee.ServiceAccountCredentials(email=service_account_email, key_data=credentials_json)
            ee.Initialize(credentials, project='fasalpramaan-earth-engine')
            logger.info("✅ Earth Engine initialized on Render")
        else:
            logger.error("❌ No Earth Engine credentials on Render")
            ee_available = False
    else:
        ee.Initialize(project='fasalpramaan-earth-engine')
        logger.info("✅ Earth Engine initialized locally")
        
except Exception as e:
    logger.error(f"❌ Earth Engine init failed: {e}")
    ee_available = False

# Set the variable
EE_AVAILABLE = ee_available if 'ee_available' in locals() else False

CACHE_DIR = os.path.join(os.path.dirname(__file__), '..', 'data', 'cache')
os.makedirs(CACHE_DIR, exist_ok=True)

EARTH_ENGINE_TIMEOUT = 8


class EarthEngineAnalyzer:
    """Main class for Earth Engine operations"""
    
    def __init__(self):
        self.sentinel2 = None
        self.landsat = None
        
        if EE_AVAILABLE:
            try:
                self.sentinel2 = ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
                self.landsat = ee.ImageCollection("LANDSAT/LC09/C02/T1_L2")
                logger.info("✅ Earth Engine collections initialized")
            except Exception as e:
                logger.error(f"❌ Failed to initialize collections: {e}")
    
    def _get_cache_key(self, latitude: float, longitude: float, start_date: str, end_date: str) -> str:
        return hashlib.md5(f"{latitude}_{longitude}_{start_date}_{end_date}".encode()).hexdigest()
    
    def _get_cached_result(self, cache_key: str) -> Optional[Dict]:
        cache_file = os.path.join(CACHE_DIR, f"{cache_key}.json")
        if os.path.exists(cache_file):
            try:
                with open(cache_file, 'r') as f:
                    data = json.load(f)
                cache_time = datetime.fromisoformat(data.get('_cache_time', '2000-01-01T00:00:00'))
                if (datetime.now() - cache_time).total_seconds() < 86400:
                    logger.info(f"✅ Cache hit for {cache_key}")
                    return data.get('result')
            except Exception as e:
                logger.warning(f"Cache read failed: {e}")
        return None
    
    def _save_to_cache(self, cache_key: str, result: Dict):
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
    
    def get_ndvi_time_series(self, latitude: float, longitude: float, start_date: str, end_date: str, max_cloud_cover: float = 20) -> Dict:
        cache_key = self._get_cache_key(latitude, longitude, start_date, end_date)
        cached = self._get_cached_result(cache_key)
        if cached:
            return cached
        
        if not EE_AVAILABLE or self.sentinel2 is None:
            logger.warning("⚠️ Earth Engine not available - returning empty")
            return {"dates": [], "ndvi_values": [], "cloud_cover": [], "image_count": 0, "message": "Earth Engine not available"}
        
        try:
            point = ee.Geometry.Point([longitude, latitude])
            
            sentinel_collection = (self.sentinel2
                .filterBounds(point)
                .filterDate(start_date, end_date)
                .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', max_cloud_cover)))
            
            count = self._get_count_with_timeout(sentinel_collection)
            logger.info(f"Found {count} Sentinel-2 images")
            
            if count > 0:
                return self._process_collection(sentinel_collection, point, count, "Sentinel-2")
            
            return {"dates": [], "ndvi_values": [], "cloud_cover": [], "image_count": 0, "message": "No cloud-free imagery available"}
                
        except Exception as e:
            logger.error(f"Error: {e}")
            return {"dates": [], "ndvi_values": [], "cloud_cover": [], "image_count": 0, "message": str(e)}
    
    def _get_count_with_timeout(self, collection) -> int:
        try:
            import threading
            result = [0]
            
            def target():
                try:
                    result[0] = collection.size().getInfo()
                except:
                    pass
            
            thread = threading.Thread(target=target)
            thread.start()
            thread.join(timeout=EARTH_ENGINE_TIMEOUT)
            return result[0]
        except:
            return 0
    
    def _process_collection(self, collection, point, count: int, source: str) -> Dict:
        dates = []
        ndvi_values = []
        cloud_covers = []
        
        limit = min(count, 10)
        ndvi_list = collection.toList(limit)
        
        for i in range(limit):
            try:
                img = ee.Image(ndvi_list.get(i))
                
                if source == "Sentinel-2":
                    nir = img.select('B8')
                    red = img.select('B4')
                    cloud = img.get('CLOUDY_PIXEL_PERCENTAGE')
                else:
                    nir = img.select('SR_B5')
                    red = img.select('SR_B4')
                    cloud = img.get('CLOUD_COVER')
                
                ndvi = nir.subtract(red).divide(nir.add(red)).rename('NDVI')
                ndvi_img = img.addBands(ndvi)
                
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
                "message": f"Extracted {len(dates)} data points"
            }
        else:
            return {"dates": [], "ndvi_values": [], "cloud_cover": [], "image_count": 0, "message": "No valid NDVI values"}
    
    def _get_value_with_timeout(self, ee_object, default=None):
        try:
            import threading
            result = [default]
            
            def target():
                try:
                    result[0] = ee_object.getInfo()
                except:
                    pass
            
            thread = threading.Thread(target=target)
            thread.start()
            thread.join(timeout=EARTH_ENGINE_TIMEOUT)
            return result[0]
        except:
            return default
    
    def get_historical_baseline(self, latitude: float, longitude: float, current_season_start: str, current_season_end: str, num_prior_seasons: int = 2) -> Dict:
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
                
                data = self.get_ndvi_time_series(
                    latitude, longitude, 
                    season_start.strftime("%Y-%m-%d"), 
                    season_end.strftime("%Y-%m-%d")
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