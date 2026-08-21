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
  const [compareMode, setCompareMode] = useState(false)
  const [selectedPlots, setSelectedPlots] = useState([])
  const [compareResult, setCompareResult] = useState(null)
  const [comparing, setComparing] = useState(false)
  const animationInterval = useRef(null)

  // Chart refs for legend toggle
  const chartRef = useRef(null)
  const animationChartRef = useRef(null)

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
    if (compareMode) {
      setSelectedPlots(prev => {
        if (prev.find(p => p.id === plot.id)) {
          return prev.filter(p => p.id !== plot.id)
        }
        if (prev.length >= 2) {
          alert('You can compare only 2 plots at a time. Please deselect one first.')
          return prev
        }
        return [...prev, plot]
      })
      return
    }

    setLoading(true)
    setError(null)
    setSelectedPlot(plot)
    setAnalysis(null)
    setAnimationData([])
    setAnimationStep(0)
    setCompareResult(null)
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

  const runComparison = async () => {
    if (selectedPlots.length !== 2) {
      alert('Please select exactly 2 plots to compare.')
      return
    }

    setComparing(true)
    setError(null)
    setCompareResult(null)
    setAnalysis(null)

    try {
      const res = await axios.post(`${API_URL}/api/compare`, {
        plot1_id: selectedPlots[0].id,
        plot2_id: selectedPlots[1].id
      }, {
        timeout: 240000
      })
      setCompareResult(res.data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Comparison failed. Please try again.')
    } finally {
      setComparing(false)
    }
  }

  const toggleCompareMode = () => {
    setCompareMode(!compareMode)
    setSelectedPlots([])
    setCompareResult(null)
  }

  const toggleAnimation = () => {
    if (isAnimating) {
      if (animationInterval.current) {
        clearInterval(animationInterval.current)
        animationInterval.current = null
      }
      setIsAnimating(false)
    } else {
      setIsAnimating(true)
      setAnimationStep(0)
      animationInterval.current = setInterval(() => {
        setAnimationStep((prev) => {
          const maxStep = animationData.length > 0 ? animationData.length : 10
          if (prev >= maxStep - 1) {
            return 0
          }
          return prev + 1
        })
      }, 800)
    }
  }

  // Legend click handler - toggles dataset visibility
  const legendClickHandler = (e, legendItem, legend) => {
    const chart = legend.chart
    const datasetIndex = legendItem.datasetIndex
    const meta = chart.getDatasetMeta(datasetIndex)
    
    // Toggle visibility
    meta.hidden = meta.hidden === null ? !chart.data.datasets[datasetIndex].hidden : !meta.hidden
    chart.update()
  }

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
        borderWidth: 3,
        hidden: false
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
            borderWidth: 2,
            hidden: false
          })
        }
      })
    }
    
    return {
      labels: analysis.current_dates || [],
      datasets: datasets
    }
  }

  const getAnimationChartData = () => {
    if (!analysis || animationData.length === 0) return null
    
    const currentStep = Math.min(animationStep + 1, animationData.length)
    const animatedValues = animationData.slice(0, currentStep).map(d => d.ndvi)
    const animatedLabels = animationData.slice(0, currentStep).map(d => d.date)
    
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
          borderWidth: 3,
          hidden: false
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
        },
        onClick: legendClickHandler
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
          text: 'NDVI (0 to 1)',
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
        },
        onClick: function(e, legendItem, legend) {
          const chart = legend.chart
          const datasetIndex = legendItem.datasetIndex
          const meta = chart.getDatasetMeta(datasetIndex)
          meta.hidden = meta.hidden === null ? !chart.data.datasets[datasetIndex].hidden : !meta.hidden
          chart.update()
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
          text: 'NDVI (0 to 1)',
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

  const parseComparisonSummary = (summary) => {
    if (!summary) return { metrics: [], insights: [], recommendation: '' }
    
    const lines = summary.split('\n').filter(line => line.trim())
    const metrics = []
    const insights = []
    let recommendation = ''
    
    let currentSection = 'metrics'
    
    lines.forEach(line => {
      const trimmed = line.trim()
      if (trimmed.startsWith('📊') || trimmed.startsWith('•')) {
        currentSection = 'metrics'
        metrics.push(trimmed)
      } else if (trimmed.startsWith('🔑')) {
        currentSection = 'insights'
      } else if (trimmed.startsWith('💡')) {
        currentSection = 'recommendation'
        recommendation = trimmed.replace('💡', '').trim()
      } else if (currentSection === 'insights' && trimmed) {
        insights.push(trimmed)
      } else if (currentSection === 'recommendation' && trimmed && !trimmed.startsWith('💡')) {
        recommendation += ' ' + trimmed
      }
    })
    
    return { metrics, insights, recommendation: recommendation.trim() }
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <div className="header-left">
            <h1>🌾 FasalPramaan</h1>
            <span className="badge">Beta</span>
          </div>
          <p className="subtitle">Independent Crop Insurance Verification</p>
        </div>
      </header>

      <main className="main">
        <div className="left-panel">
          <div className="card">
            <div className="card-title">
              <span className="icon">📍</span> Select a Demo Plot
            </div>
            <div className="compare-toggle">
              <button 
                className={`compare-toggle-btn ${compareMode ? 'active' : ''}`}
                onClick={toggleCompareMode}
              >
                {compareMode ? '🔀 Exit Compare Mode' : '🔀 Compare Plots'}
              </button>
              {compareMode && (
                <div className="compare-info">
                  <span>Select 2 plots to compare</span>
                  <span className="selected-count">{selectedPlots.length}/2 selected</span>
                  {selectedPlots.length === 2 && (
                    <button className="compare-run-btn" onClick={runComparison} disabled={comparing}>
                      {comparing ? '⏳ Comparing...' : '⚡ Run Comparison'}
                    </button>
                  )}
                </div>
              )}
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
              {plots.map((plot) => {
                const isSelected = selectedPlots.find(p => p.id === plot.id)
                return (
                  <button
                    key={plot.id}
                    className={`plot-btn ${selectedPlot?.id === plot.id && !compareMode ? 'active' : ''} ${compareMode && isSelected ? 'compare-selected' : ''}`}
                    onClick={() => analyzePlot(plot)}
                  >
                    <span className="plot-name">{plot.icon || '🌾'} {plot.name}</span>
                    <span className="plot-meta">{plot.crop} · {plot.state}</span>
                    {compareMode && isSelected && <span className="selected-badge">✓ Selected</span>}
                  </button>
                )
              })}
            </div>
          </div>

          {analysis && !compareMode && (
            <>
              <div className="card">
                <div className="card-title">
                  <span className="icon">📈</span> NDVI Trend
                </div>
                <div className="chart-container">
                  <Line 
                    ref={chartRef}
                    data={getChartData()} 
                    options={chartOptions} 
                  />
                </div>
              </div>

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
                      ref={animationChartRef}
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

          {compareResult && compareMode && (
            <div className="card compare-result-card">
              <div className="card-title">
                <span className="icon">📊</span> Comparison Results
                <button 
                  className="close-compare-btn"
                  onClick={() => {
                    setCompareResult(null)
                    setSelectedPlots([])
                  }}
                >
                  ✕
                </button>
              </div>
              
              <div className="compare-grid">
                <div className={`compare-item ${compareResult.plot1.status === 'anomaly_detected' ? 'stress' : 'healthy'}`}>
                  <div className="compare-item-header">
                    <span className="compare-crop">{compareResult.plot1.crop}</span>
                    <span className={`compare-status-badge ${compareResult.plot1.status}`}>
                      {compareResult.plot1.status === 'anomaly_detected' ? '⚠️ Stress' : '✅ Healthy'}
                    </span>
                  </div>
                  <h4>{compareResult.plot1.plot_name}</h4>
                  <div className="compare-metrics">
                    <div className="compare-metric">
                      <span className="metric-icon">🌿</span>
                      <span className="metric-value">{compareResult.plot1.deviation_score.toFixed(2)} σ</span>
                      <span className="metric-label">NDVI Deviation</span>
                    </div>
                    <div className="compare-metric">
                      <span className="metric-icon">💧</span>
                      <span className="metric-value">{compareResult.plot1.rainfall_total.toFixed(1)} mm</span>
                      <span className="metric-label">Rainfall</span>
                    </div>
                    <div className="compare-metric">
                      <span className="metric-icon">📅</span>
                      <span className="metric-value">{compareResult.plot1.image_count}</span>
                      <span className="metric-label">Images</span>
                    </div>
                  </div>
                </div>
                
                <div className="compare-vs">
                  <span className="vs-badge">⚡ VS</span>
                </div>
                
                <div className={`compare-item ${compareResult.plot2.status === 'anomaly_detected' ? 'stress' : 'healthy'}`}>
                  <div className="compare-item-header">
                    <span className="compare-crop">{compareResult.plot2.crop}</span>
                    <span className={`compare-status-badge ${compareResult.plot2.status}`}>
                      {compareResult.plot2.status === 'anomaly_detected' ? '⚠️ Stress' : '✅ Healthy'}
                    </span>
                  </div>
                  <h4>{compareResult.plot2.plot_name}</h4>
                  <div className="compare-metrics">
                    <div className="compare-metric">
                      <span className="metric-icon">🌿</span>
                      <span className="metric-value">{compareResult.plot2.deviation_score.toFixed(2)} σ</span>
                      <span className="metric-label">NDVI Deviation</span>
                    </div>
                    <div className="compare-metric">
                      <span className="metric-icon">💧</span>
                      <span className="metric-value">{compareResult.plot2.rainfall_total.toFixed(1)} mm</span>
                      <span className="metric-label">Rainfall</span>
                    </div>
                    <div className="compare-metric">
                      <span className="metric-icon">📅</span>
                      <span className="metric-value">{compareResult.plot2.image_count}</span>
                      <span className="metric-label">Images</span>
                    </div>
                  </div>
                </div>
              </div>

              {(() => {
                const parsed = parseComparisonSummary(compareResult.comparison_summary)
                return (
                  <>
                    {parsed.insights.length > 0 && (
                      <div className="compare-insights">
                        <h4>🔑 Key Insights</h4>
                        <ul>
                          {parsed.insights.map((insight, idx) => (
                            <li key={idx}>{insight}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {parsed.recommendation && (
                      <div className={`compare-recommendation ${compareResult.plot1.status === 'anomaly_detected' && compareResult.plot2.status === 'anomaly_detected' ? 'warning' : ''}`}>
                        <span className="rec-icon">💡</span>
                        <div>
                          <strong>Recommendation</strong>
                          <p>{parsed.recommendation}</p>
                        </div>
                      </div>
                    )}
                  </>
                )
              })()}
            </div>
          )}
        </div>

        <div className="right-panel">
          <div className="card">
            <div className="card-title">
              <span className="icon">📊</span> {compareMode ? 'Comparison Mode' : 'Analysis Results'}
            </div>
            
            {loading && (
              <div className="loading">
                <div className="spinner"></div>
                <p>Analyzing satellite and weather data...</p>
                <p className="loading-hint">This may take 30-90 seconds</p>
              </div>
            )}

            {comparing && (
              <div className="loading">
                <div className="spinner"></div>
                <p>Comparing plots...</p>
                <p className="loading-hint">This may take 60-120 seconds</p>
              </div>
            )}

            {error && (
              <div className="error">
                <span>❌</span>
                <p>{error}</p>
              </div>
            )}

            {analysis && !loading && !compareMode && (
              <div className="results">
                <div className={`status-banner ${analysis.status || 'normal'}`}>
                  <span className="status-icon">
                    {analysis.status === 'anomaly_detected' ? '⚠️' : '✅'}
                  </span>
                  <div>
                    <h3>{analysis.status === 'anomaly_detected' ? 'Anomaly Detected' : 'Normal Pattern'}</h3>
                    <p>{analysis.status_description || 'Analysis complete'}</p>
                  </div>
                </div>

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

                <div className="summary-box">
                  <h4>📋 Plain Language Summary</h4>
                  <p>{analysis.summary || 'No summary available'}</p>
                </div>

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

            {!analysis && !loading && !compareMode && !error && (
              <div className="placeholder">
                <p>Select a plot on the map to run the analysis.</p>
                <div className="hint">Showing data for documented cases across India</div>
              </div>
            )}

            {compareMode && !compareResult && !comparing && !error && (
              <div className="placeholder">
                <p>🔀 Select 2 plots to compare them side-by-side</p>
                <div className="hint">Click on markers or buttons to select plots</div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

export default App