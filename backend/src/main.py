from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from src.config import settings
from src.models import PlotRequest, AnalysisResult
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="FasalPramaan API",
    description="Independent crop insurance verification tool using satellite and weather data",
    version="1.0.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {
        "message": "FasalPramaan API",
        "status": "running",
        "version": "1.0.0"
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

@app.get("/api/demo-plots")
async def get_demo_plots():
    """Return the list of pre-configured demo plots."""
    return list(settings.DEMO_PLOTS.values())

@app.post("/api/analyze", response_model=AnalysisResult)
async def analyze_plot(request: PlotRequest):
    """
    Analyze a plot using satellite and weather data.
    
    This is the main endpoint that:
    1. Fetches NDVI data from Earth Engine
    2. Compares against historical baseline
    3. Cross-verifies with rainfall data
    4. Generates deviation score and appeal text
    """
    try:
        logger.info(f"Analyzing plot at {request.latitude}, {request.longitude}")
        
        # For now, return mock data until we build Phase 2
        # This will be replaced with real Earth Engine calls
        return get_mock_analysis(request)
        
    except Exception as e:
        logger.error(f"Analysis failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

def get_mock_analysis(request: PlotRequest) -> AnalysisResult:
    """Temporary mock response until Phase 2 is built"""
    return AnalysisResult(
        plot_id="demo_1",
        plot_name=request.name or "Demo Plot",
        latitude=request.latitude,
        longitude=request.longitude,
        crop=request.crop or "unknown",
        season="Kharif 2017",
        current_ndvi_values=[0.45, 0.42, 0.38, 0.35, 0.32, 0.28, 0.25],
        current_dates=["2017-07-15", "2017-07-22", "2017-07-29", "2017-08-05", "2017-08-12", "2017-08-19", "2017-08-26"],
        historical_ndvi_values=[
            [0.52, 0.50, 0.48, 0.47, 0.46, 0.45, 0.44],
            [0.53, 0.51, 0.49, 0.48, 0.47, 0.46, 0.45]
        ],
        historical_dates=[
            ["2016-07-15", "2016-07-22", "2016-07-29", "2016-08-05", "2016-08-12", "2016-08-19", "2016-08-26"],
            ["2015-07-15", "2015-07-22", "2015-07-29", "2015-08-05", "2015-08-12", "2015-08-19", "2015-08-26"]
        ],
        deviation_score=-2.1,
        deviation_description="NDVI is 2.1 standard deviations below historical average, indicating significant vegetation stress",
        rainfall_total=125.4,
        rainfall_days=8,
        rainfall_comparison="Rainfall was 40% below normal for this period, supporting the drought claim",
        status="anomaly_detected",
        status_description="⚠️ Significant anomaly detected - vegetation health is substantially below historical baseline",
        summary="The analysis shows a significant decline in vegetation health (NDVI) during the claimed damage period, which is 2.1 standard deviations below the historical average. Rainfall was 40% below normal, supporting the drought claim. This evidence can be used to support an insurance claim appeal.",
        appeal_text="To the District Grievance Redressal Committee,\n\nI am writing to formally appeal the crop insurance assessment for my plot in [District], [State] for the [Season] season. Based on independent satellite data analysis using Sentinel-2 imagery, the following evidence is presented:\n\n1. NDVI (vegetation health) during the claimed damage period was 2.1 standard deviations below the historical average for the same plot.\n\n2. Rainfall during this period was 40% below normal, supporting the claim of drought conditions.\n\n3. This independent analysis contradicts the insurance company's assessment and warrants a re-evaluation of my claim.\n\nI request a formal review of my claim with consideration of this independent evidence.",
        image_count=7,
        cloud_cover_avg=12.5
    )