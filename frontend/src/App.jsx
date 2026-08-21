import React, { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import './App.css'

// Register ChartJS
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

// Fix Leaflet default marker icons
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

const API_URL = 'http://localhost:8000'

function App() {
  const [plots, setPlots] = useState([])
  const [selectedPlot, setSelectedPlot] = useState(null)
  const [analysis, setAnalysis] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [downloading, setDownloading] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  const [animationStep, setAnimationStep] = useState(0)
  const [animationData, setAnimationData] = useState([])
  const animationInterval = useRef(null)

  // Fetch demo plots on mount
  useEffect(() => {
    fetchDemoPlots()
    return () => {
      if (animationInterval.current) {
        clearInterval(animationInterval.current)
      }
    }
  }, [])

  const fetchDemoPlots = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/demo-plots`)
      setPlots(res.data)
    } catch (err) {
      console.error('Error fetching plots:', err)
    }
  }

  const analyzePlot = async (plot) => {
    setLoading(true)
    setError(null)
    setSelectedPlot(plot)
    setAnalysis(null)
    setAnimationData([])
    setAnimationStep(0)
    if (animationInterval.current) {
      clearInterval(animationInterval.current)
      animationInterval.current = null
    }
    
    try {
      const res = await axios.post(`${API_URL}/api/analyze`, {
        latitude: plot.latitude,
        longitude: plot.longitude,
        start_date: plot.damage_period.start,
        end_date: plot.damage_period.end,
        crop: plot.crop,
        name: plot.name
      }, {
        timeout: 180000
      })
      setAnalysis(res.data)
      // Prepare animation data
      if (res.data.current_ndvi_values && res.data.current_ndvi_values.length > 0) {
        const data = res.data.current_ndvi_values.map((val, idx) => ({
          date: res.data.current_dates[idx] || `Day ${idx + 1}`,
          ndvi: val
        }))
        setAnimationData(data)
      }
    } catch (err) {
      if (err.code === 'ECONNABORTED') {
        setError('⏱️ Analysis is taking longer than expected. The plot may have limited satellite data. Please try again or select a different plot.')
      } else {
        setError(err.response?.data?.detail || 'Analysis failed. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  // Start/Stop animation
  const toggleAnimation = () => {
    if (isAnimating) {
      // Stop animation
      if (animationInterval.current) {
        clearInterval(animationInterval.current)
        animationInterval.current = null
      }
      setIsAnimating(false)
    } else {
      // Start animation
      setIsAnimating(true)
      setAnimationStep(0)
      animationInterval.current = setInterval(() => {
        setAnimationStep((prev) => {
          const maxStep = animationData.length > 0 ? animationData.length : 10
          if (prev >= maxStep - 1) {
            // Loop back to start
            return 0
          }
          return prev + 1
        })
      }, 800)
    }
  }

  // Chart data for NDVI
  const getChartData = () => {
    if (!analysis) return null
    
    const colors = ['#2d6a4f', '#94a3b8', '#cbd5e1']
    const datasets = [
      {
        label: 'Current Season',
        data: analysis.current_ndvi_values || [],
        borderColor: colors[0],
        backgroundColor: 'rgba(45, 106, 79, 0.15)',
        fill: true,
        tension: 0.4,
        pointRadius: 5,
        pointHoverRadius: 8,
        borderWidth: 3
      }
    ]
    
    if (analysis.historical_ndvi_values) {
      analysis.historical_ndvi_values.forEach((values, index) => {
        if (values && values.length > 0) {
          datasets.push({
            label: `${index + 1} Year Prior`,
            data: values || [],
            borderColor: colors[(index + 1) % colors.length],
            backgroundColor: 'transparent',
            borderDash: [6, 4],
            tension: 0.4,
            pointRadius: 3,
            pointHoverRadius: 6,
            borderWidth: 2
          })
        }
      })
    }
    
    return {
      labels: analysis.current_dates || [],
      datasets: datasets
    }
  }

  // Animation chart data
  const getAnimationChartData = () => {
    if (!analysis || animationData.length === 0) return null
    
    const currentStep = Math.min(animationStep + 1, animationData.length)
    const animatedValues = animationData.slice(0, currentStep).map(d => d.ndvi)
    const animatedLabels = animationData.slice(0, currentStep).map(d => d.date)
    
    // Pad with null values to maintain chart size
    while (animatedValues.length < animationData.length) {
      animatedValues.push(null)
    }
    while (animatedLabels.length < animationData.length) {
      animatedLabels.push('')
    }
    
    return {
      labels: animatedLabels,
      datasets: [
        {
          label: 'NDVI Progression',
          data: animatedValues,
          borderColor: '#2d6a4f',
          backgroundColor: 'rgba(45, 106, 79, 0.2)',
          fill: true,
          tension: 0.4,
          pointRadius: 6,
          pointBackgroundColor: '#1a472a',
          borderWidth: 3
        }
      ]
    }
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          usePointStyle: true,
          padding: 16,
          font: { size: 11 }
        }
      },
      title: {
        display: true,
        text: 'NDVI Time Series (Vegetation Health)',
        font: { size: 13, weight: 'bold' }
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            if (context.parsed.y === null) return 'Loading...'
            return `${context.dataset.label}: ${context.parsed.y.toFixed(3)}`
          }
        }
      }
    },
    scales: {
      y: {
        min: 0,
        max: 1,
        ticks: { stepSize: 0.2 },
        title: {
          display: true,
          text: 'NDVI (0-1)',
          font: { size: 10 }
        }
      },
      x: {
        title: {
          display: true,
          text: 'Date',
          font: { size: 10 }
        }
      }
    }
  }

  const animationChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          usePointStyle: true,
          padding: 16,
          font: { size: 11 }
        }
      },
      title: {
        display: true,
        text: '🌱 NDVI Progression Over Time',
        font: { size: 13, weight: 'bold' }
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            if (context.parsed.y === null) return 'Loading...'
            return `NDVI: ${context.parsed.y.toFixed(3)}`
          }
        }
      }
    },
    scales: {
      y: {
        min: 0,
        max: 1,
        ticks: { stepSize: 0.2 },
        title: {
          display: true,
          text: 'NDVI (0-1)',
          font: { size: 10 }
        }
      },
      x: {
        title: {
          display: true,
          text: 'Date',
          font: { size: 10 }
        }
      }
    },
    animation: {
      duration: 0
    }
  }

  const downloadAppeal = async (format) => {
    if (!selectedPlot || !analysis) return
    
    setDownloading(true)
    try {
      const response = await axios.post(`${API_URL}/api/appeal/${format}`, {
        latitude: selectedPlot.latitude,
        longitude: selectedPlot.longitude,
        start_date: selectedPlot.damage_period.start,
        end_date: selectedPlot.damage_period.end,
        crop: selectedPlot.crop,
        name: selectedPlot.name
      }, {
        responseType: 'blob',
        timeout: 120000
      })
      
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      const extensions = { pdf: 'pdf', word: 'docx', html: 'html' }
      link.setAttribute('download', `appeal_${selectedPlot.name.replace(/\s+/g, '_')}.${extensions[format]}`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Download failed:', err)
      alert('Failed to download appeal document. Please try again.')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-content">
          <div className="header-left">
            <h1>🌾 FasalPramaan</h1>
            <span className="badge">Beta</span>
          </div>
          <p className="subtitle">Independent Crop Insurance Verification</p>
        </div>
      </header>

      {/* Main Content */}
      <main className="main">
        {/* Left Panel - Map + Chart */}
        <div className="left-panel">
          <div className="card">
            <div className="card-title">
              <span className="icon">📍</span> Select a Demo Plot
            </div>
            <div className="map-container">
              <MapContainer 
                center={[20.0, 78.0]} 
                zoom={5} 
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                {plots.map((plot) => (
                  <Marker
                    key={plot.id}
                    position={[plot.latitude, plot.longitude]}
                    eventHandlers={{ click: () => analyzePlot(plot) }}
                  >
                    <Popup>
                      <div className="popup-content">
                        <div className="plot-name">{plot.name}</div>
                        <div className="plot-detail">{plot.icon || '🌾'} {plot.crop}</div>
                        <div className="plot-detail">📅 {plot.season}</div>
                        <div className="plot-detail">📍 {plot.district}, {plot.state}</div>
                        <div className="plot-description">{plot.description}</div>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
            <div className="plot-selector">
              {plots.map((plot) => (
                <button
                  key={plot.id}
                  className={`plot-btn ${selectedPlot?.id === plot.id ? 'active' : ''}`}
                  onClick={() => analyzePlot(plot)}
                >
                  <span className="plot-name">{plot.icon || '🌾'} {plot.name}</span>
                  <span className="plot-meta">{plot.crop} · {plot.state}</span>
                </button>
              ))}
            </div>
          </div>

          {analysis && (
            <>
              <div className="card">
                <div className="card-title">
                  <span className="icon">📈</span> NDVI Trend
                </div>
                <div className="chart-container">
                  <Line data={getChartData()} options={chartOptions} />
                </div>
              </div>

              {/* Animation Chart */}
              <div className="card">
                <div className="animation-header">
                  <div className="card-title" style={{ marginBottom: 0 }}>
                    <span className="icon">▶️</span> NDVI Time Lapse
                  </div>
                  <div className="animation-controls">
                    <button 
                      className={`animation-btn ${isAnimating ? 'active' : ''}`}
                      onClick={toggleAnimation}
                      disabled={!animationData || animationData.length === 0}
                    >
                      {isAnimating ? '⏸️ Pause' : '▶️ Play'}
                    </button>
                    <span className="animation-step-info">
                      {animationData.length > 0 ? `${Math.min(animationStep + 1, animationData.length)} / ${animationData.length}` : '0 / 0'}
                    </span>
                    <button 
                      className="animation-btn reset-btn"
                      onClick={() => {
                        if (animationInterval.current) {
                          clearInterval(animationInterval.current)
                          animationInterval.current = null
                        }
                        setIsAnimating(false)
                        setAnimationStep(0)
                      }}
                      disabled={!animationData || animationData.length === 0}
                    >
                      🔄 Reset
                    </button>
                  </div>
                </div>
                <div className="chart-container">
                  {animationData && animationData.length > 0 ? (
                    <Line 
                      data={getAnimationChartData()} 
                      options={animationChartOptions} 
                      key={animationStep}
                    />
                  ) : (
                    <div className="animation-placeholder">
                      <p>No NDVI data available for animation</p>
                    </div>
                  )}
                </div>
                <div className="animation-progress">
                  <div 
                    className="animation-progress-bar" 
                    style={{ 
                      width: `${animationData.length > 0 ? ((animationStep + 1) / animationData.length * 100) : 0}%` 
                    }}
                  ></div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Right Panel - Analysis Results */}
        <div className="right-panel">
          <div className="card">
            <div className="card-title">
              <span className="icon">📊</span> Analysis Results
            </div>
            
            {loading && (
              <div className="loading">
                <div className="spinner"></div>
                <p>Analyzing satellite and weather data...</p>
                <p className="loading-hint">This may take 30-90 seconds depending on data availability</p>
              </div>
            )}

            {error && (
              <div className="error">
                <span>❌</span>
                <p>{error}</p>
              </div>
            )}

            {analysis && !loading && (
              <div className="results">
                {/* Status Banner */}
                <div className={`status-banner ${analysis.status || 'normal'}`}>
                  <span className="status-icon">
                    {analysis.status === 'anomaly_detected' ? '⚠️' : '✅'}
                  </span>
                  <div>
                    <h3>{analysis.status === 'anomaly_detected' ? 'Anomaly Detected' : 'Normal Pattern'}</h3>
                    <p>{analysis.status_description || 'Analysis complete'}</p>
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="stats-grid">
                  <div className="stat-card">
                    <div className="stat-icon">🌿</div>
                    <h4>NDVI Deviation</h4>
                    <div className={`stat-value ${(analysis.deviation_score || 0) < -1 ? 'negative' : 'normal'}`}>
                      {(analysis.deviation_score || 0).toFixed(2)} σ
                    </div>
                    <div className="stat-label">from historical baseline</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon">💧</div>
                    <h4>Rainfall</h4>
                    <div className="stat-value">{(analysis.rainfall_total || 0).toFixed(1)} mm</div>
                    <div className="stat-label">{analysis.rainfall_comparison || 'No data'}</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon">🌡️</div>
                    <h4>Temperature</h4>
                    <div className="stat-value">{(analysis.avg_temperature || 0).toFixed(1)}°C</div>
                    <div className="stat-label">Avg | Max: {(analysis.max_temperature || 0).toFixed(1)}°C</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon">💨</div>
                    <h4>Humidity</h4>
                    <div className="stat-value">{(analysis.avg_humidity || 0).toFixed(0)}%</div>
                    <div className="stat-label">Average during period</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon">📅</div>
                    <h4>Data Points</h4>
                    <div className="stat-value">{analysis.image_count || 0}</div>
                    <div className="stat-label">cloud-free images</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon">📊</div>
                    <h4>Status</h4>
                    <div className={`stat-value ${analysis.status === 'anomaly_detected' ? 'negative' : 'normal'}`}>
                      {analysis.status === 'anomaly_detected' ? '⚠️ Stress' : '✅ Healthy'}
                    </div>
                    <div className="stat-label">vegetation condition</div>
                  </div>
                </div>

                {/* Weather Summary */}
                {analysis.weather_summary && (
                  <div className="weather-summary-box">
                    <h4>🌤️ Weather Summary</h4>
                    <p>{analysis.weather_summary}</p>
                    {analysis.weather_source && analysis.weather_source !== 'MOCK DATA' && (
                      <div className="data-source">✅ {analysis.weather_source}</div>
                    )}
                    {analysis.weather_source && analysis.weather_source === 'MOCK DATA' && (
                      <div className="data-source-mock">⚠️ {analysis.weather_source}</div>
                    )}
                  </div>
                )}

                {/* Summary */}
                <div className="summary-box">
                  <h4>📋 Plain Language Summary</h4>
                  <p>{analysis.summary || 'No summary available'}</p>
                </div>

                {/* Download Section */}
                <div className="download-section">
                  <div className="download-label">📄 Download Appeal Document:</div>
                  <div className="download-buttons">
                    <button 
                      className="appeal-btn"
                      onClick={() => downloadAppeal('pdf')}
                      disabled={downloading}
                    >
                      PDF
                    </button>
                    <button 
                      className="appeal-btn"
                      onClick={() => downloadAppeal('word')}
                      disabled={downloading}
                    >
                      Word
                    </button>
                    <button 
                      className="appeal-btn"
                      onClick={() => downloadAppeal('html')}
                      disabled={downloading}
                    >
                      HTML
                    </button>
                  </div>
                  {downloading && (
                    <div className="downloading-text">⏳ Generating document...</div>
                  )}
                </div>
              </div>
            )}

            {!analysis && !loading && !error && (
              <div className="placeholder">
                <p>Select a plot on the map to run the analysis.</p>
                <div className="hint">Showing data for documented cases across India</div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

export default App