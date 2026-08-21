import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import { Leaf, Droplet, AlertTriangle, FileText, Loader2, CheckCircle, XCircle } from 'lucide-react'
import './App.css'

// Fix Leaflet icons
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
      setError(err.response?.data?.detail || 'Analysis failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <h1>🌾 FasalPramaan</h1>
          <p className="subtitle">Independent Crop Insurance Verification</p>
        </div>
      </header>

      <main className="main">
        <div className="map-section">
          <h2>📍 Select a Demo Plot</h2>
          <div className="map-container">
            <MapContainer center={[29.0, 75.5]} zoom={8} style={{ height: '380px', width: '100%' }}>
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
                {plot.name}
              </button>
            ))}
          </div>
        </div>

        <div className="analysis-section">
          <h2>📊 Analysis Results</h2>
          
          {loading && (
            <div className="loading">
              <Loader2 className="spinner" />
              <p>Analyzing satellite and weather data...</p>
            </div>
          )}

          {error && (
            <div className="error">
              <XCircle size={20} />
              <p>{error}</p>
            </div>
          )}

          {analysis && !loading && (
            <div className="results">
              <div className={`status-banner ${analysis.status}`}>
                {analysis.status === 'anomaly_detected' ? <AlertTriangle size={24} /> : <CheckCircle size={24} />}
                <div>
                  <h3>{analysis.status === 'anomaly_detected' ? '⚠️ Anomaly Detected' : '✅ Normal Pattern'}</h3>
                  <p>{analysis.status_description}</p>
                </div>
              </div>

              <div className="stats-grid">
                <div className="stat-card">
                  <Leaf size={20} />
                  <h4>NDVI Deviation</h4>
                  <p className={`stat-value ${analysis.deviation_score < -1 ? 'negative' : 'normal'}`}>
                    {analysis.deviation_score.toFixed(2)} σ
                  </p>
                </div>
                <div className="stat-card">
                  <Droplet size={20} />
                  <h4>Rainfall</h4>
                  <p className="stat-value">{analysis.rainfall_total.toFixed(1)} mm</p>
                  <p className="stat-label">{analysis.rainfall_comparison}</p>
                </div>
              </div>

              <div className="summary-box">
                <h4>📋 Summary</h4>
                <p>{analysis.summary}</p>
              </div>

              <button className="appeal-btn">
                <FileText size={16} />
                Download Appeal Document
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
      </main>
    </div>
  )
}

export default App