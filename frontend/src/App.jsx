import React, { useState, useEffect } from 'react'
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

  // Fetch demo plots on mount
  useEffect(() => {
    fetchDemoPlots()
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
    
    try {
      const res = await axios.post(`${API_URL}/api/analyze`, {
        latitude: plot.latitude,
        longitude: plot.longitude,
        start_date: plot.damage_period.start,
        end_date: plot.damage_period.end,
        crop: plot.crop,
        name: plot.name
      })
      setAnalysis(res.data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Analysis failed. Please try again.')
    } finally {
      setLoading(false)
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
      })
    }
    
    return {
      labels: analysis.current_dates || [],
      datasets: datasets
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
          padding: 20,
          font: { size: 12 }
        }
      },
      title: {
        display: true,
        text: 'NDVI Time Series (Vegetation Health)',
        font: { size: 14, weight: 'bold' }
      },
      tooltip: {
        callbacks: {
          label: function(context) {
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
          text: 'NDVI (0-1)'
        }
      },
      x: {
        title: {
          display: true,
          text: 'Date'
        }
      }
    }
  }

  const downloadAppeal = () => {
    if (!analysis) return
    const content = analysis.appeal_text || 'No appeal text available'
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `appeal_${selectedPlot?.name || 'plot'}.txt`
    a.click()
    URL.revokeObjectURL(url)
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
          <div className="card map-section">
            <h2>📍 Select a Demo Plot</h2>
            <div className="map-container">
              <MapContainer 
                center={[29.0, 75.5]} 
                zoom={8} 
                style={{ height: '350px', width: '100%' }}
              >
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                {plots.map((plot) => (
                  <Marker
                    key={plot.id}
                    position={[plot.latitude, plot.longitude]}
                    eventHandlers={{ click: () => analyzePlot(plot) }}
                  >
                    <Popup>
                      <strong>{plot.name}</strong><br />
                      🌾 {plot.crop}<br />
                      📅 {plot.season}
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
                  <span className="crop-icon">🌾</span>
                  {plot.name}
                </button>
              ))}
            </div>
          </div>

          {analysis && (
            <div className="card chart-section">
              <h3>📈 NDVI Trend</h3>
              <div className="chart-container">
                <Line data={getChartData()} options={chartOptions} />
              </div>
            </div>
          )}
        </div>

        {/* Right Panel - Analysis Results */}
        <div className="right-panel">
          <div className="card analysis-section">
            <h2>📊 Analysis Results</h2>
            
            {loading && (
              <div className="loading">
                <div className="spinner"></div>
                <p>Analyzing satellite and weather data...</p>
                <p className="loading-hint">This may take 10-30 seconds</p>
              </div>
            )}

            {error && (
              <div className="error">
                <span className="error-icon">❌</span>
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
                    <span className="stat-icon">🌿</span>
                    <h4>NDVI Deviation</h4>
                    <p className={`stat-value ${(analysis.deviation_score || 0) < -1 ? 'negative' : 'normal'}`}>
                      {(analysis.deviation_score || 0).toFixed(2)} σ
                    </p>
                    <p className="stat-label">from historical baseline</p>
                  </div>
                  <div className="stat-card">
                    <span className="stat-icon">💧</span>
                    <h4>Rainfall</h4>
                    <p className="stat-value">{(analysis.rainfall_total || 0).toFixed(1)} mm</p>
                    <p className="stat-label">{analysis.rainfall_comparison || 'No data'}</p>
                    {analysis.weather_source && analysis.weather_source !== 'MOCK DATA' && (
                      <p className="data-source">✅ {analysis.weather_source}</p>
                    )}
                    {analysis.weather_source && analysis.weather_source === 'MOCK DATA' && (
                      <p className="data-source-mock">⚠️ {analysis.weather_source}</p>
                    )}
                  </div>
                  <div className="stat-card">
                    <span className="stat-icon">📅</span>
                    <h4>Data Points</h4>
                    <p className="stat-value">{analysis.image_count || 0}</p>
                    <p className="stat-label">cloud-free images</p>
                  </div>
                  <div className="stat-card">
                    <span className="stat-icon">📊</span>
                    <h4>Status</h4>
                    <p className={`stat-value ${analysis.status === 'anomaly_detected' ? 'negative' : 'normal'}`}>
                      {analysis.status === 'anomaly_detected' ? '⚠️ Stress' : '✅ Healthy'}
                    </p>
                    <p className="stat-label">vegetation condition</p>
                  </div>
                </div>

                {/* Summary */}
                <div className="summary-box">
                  <h4>📋 Plain Language Summary</h4>
                  <p>{analysis.summary || 'No summary available'}</p>
                </div>

                {/* Download Button */}
                <button className="appeal-btn" onClick={downloadAppeal}>
                  📄 Download Appeal Document
                </button>
              </div>
            )}

            {!analysis && !loading && !error && (
              <div className="placeholder">
                <p>Select a plot on the map to run the analysis.</p>
                <p className="hint">Showing data for the 2017 Haryana dispute case.</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

export default App