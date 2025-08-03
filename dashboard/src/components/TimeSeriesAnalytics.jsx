import React, { useState, useEffect, useMemo } from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
  Dot
} from 'recharts';
import { format, subHours, startOfHour } from 'date-fns';
import { TrendingUp, TrendingDown, Warning as AlertTriangle, ShowChart as Activity } from '@mui/icons-material';

// Simple anomaly detection using z-score
const detectAnomalies = (data, threshold = 2.5) => {
  const values = data.map(d => d.value);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  
  return data.map(point => ({
    ...point,
    isAnomaly: Math.abs(point.value - mean) > threshold * stdDev,
    zScore: (point.value - mean) / stdDev,
    expectedValue: mean,
    upperBound: mean + (threshold * stdDev),
    lowerBound: mean - (threshold * stdDev)
  }));
};

// Calculate moving average for trend analysis
const calculateMovingAverage = (data, window = 5) => {
  return data.map((point, index) => {
    const start = Math.max(0, index - window + 1);
    const windowData = data.slice(start, index + 1);
    const avg = windowData.reduce((sum, d) => sum + d.value, 0) / windowData.length;
    return { ...point, movingAvg: Math.round(avg) };
  });
};

const TimeSeriesAnalytics = ({ data, timeRange = '24h' }) => {
  const [selectedMetric, setSelectedMetric] = useState('emailVolume');
  const [showAnomalies, setShowAnomalies] = useState(true);
  const [showTrend, setShowTrend] = useState(true);
  const [anomalyStats, setAnomalyStats] = useState({
    total: 0,
    critical: 0,
    warning: 0,
    trend: 'stable'
  });

  // Process data with anomaly detection
  const processedData = useMemo(() => {
    if (!data || !data[selectedMetric]) return [];
    
    let processed = detectAnomalies(data[selectedMetric]);
    processed = calculateMovingAverage(processed);
    
    // Calculate anomaly statistics
    const anomalies = processed.filter(d => d.isAnomaly);
    const criticalAnomalies = anomalies.filter(d => Math.abs(d.zScore) > 3);
    const lastValues = processed.slice(-10).map(d => d.value);
    const firstValues = processed.slice(0, 10).map(d => d.value);
    const lastAvg = lastValues.reduce((a, b) => a + b, 0) / lastValues.length;
    const firstAvg = firstValues.reduce((a, b) => a + b, 0) / firstValues.length;
    
    setAnomalyStats({
      total: anomalies.length,
      critical: criticalAnomalies.length,
      warning: anomalies.length - criticalAnomalies.length,
      trend: lastAvg > firstAvg * 1.1 ? 'up' : lastAvg < firstAvg * 0.9 ? 'down' : 'stable'
    });
    
    return processed;
  }, [data, selectedMetric]);

  const metrics = [
    { key: 'emailVolume', label: 'Email Volume', color: '#3B82F6', unit: 'emails' },
    { key: 'deliveryRate', label: 'Delivery Rate', color: '#10B981', unit: '%' },
    { key: 'errorRate', label: 'Error Rate', color: '#EF4444', unit: '%' },
    { key: 'avgProcessingTime', label: 'Processing Time', color: '#8B5CF6', unit: 'ms' },
    { key: 'queueDepth', label: 'Queue Depth', color: '#F59E0B', unit: 'emails' }
  ];

  const currentMetric = metrics.find(m => m.key === selectedMetric);

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload[0]) {
      const data = payload[0].payload;
      return (
        <div className="bg-gray-900 text-white p-3 rounded-lg shadow-lg">
          <p className="font-semibold">{format(new Date(label), 'MMM dd, HH:mm')}</p>
          <p className="text-sm mt-1">
            Value: {data.value} {currentMetric.unit}
          </p>
          {data.isAnomaly && (
            <p className="text-yellow-400 text-sm mt-1">
              ⚠️ Anomaly Detected (z-score: {data.zScore.toFixed(2)})
            </p>
          )}
          {showTrend && (
            <p className="text-gray-300 text-sm">
              Trend: {data.movingAvg} {currentMetric.unit}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  // Custom dot for anomalies
  const CustomDot = (props) => {
    const { cx, cy, payload } = props;
    if (payload.isAnomaly) {
      return (
        <circle
          cx={cx}
          cy={cy}
          r={6}
          fill={Math.abs(payload.zScore) > 3 ? '#EF4444' : '#F59E0B'}
          stroke="#fff"
          strokeWidth={2}
        />
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Time Series Analytics</h3>
            <p className="text-sm text-gray-600">
              Real-time metrics with automatic anomaly detection
            </p>
          </div>
          
          {/* Anomaly Stats */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              {anomalyStats.trend === 'up' ? (
                <TrendingUp className="h-5 w-5 text-green-500" />
              ) : anomalyStats.trend === 'down' ? (
                <TrendingDown className="h-5 w-5 text-red-500" />
              ) : (
                <Activity className="h-5 w-5 text-gray-500" />
              )}
              <span className="text-sm font-medium text-gray-700">
                Trend: {anomalyStats.trend}
              </span>
            </div>
            {anomalyStats.total > 0 && (
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                <span className="text-sm font-medium text-gray-700">
                  {anomalyStats.total} anomalies
                  {anomalyStats.critical > 0 && (
                    <span className="text-red-600 ml-1">
                      ({anomalyStats.critical} critical)
                    </span>
                  )}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Metric Selector */}
      <div className="flex space-x-2 mb-4">
        {metrics.map(metric => (
          <button
            key={metric.key}
            onClick={() => setSelectedMetric(metric.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedMetric === metric.key
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {metric.label}
          </button>
        ))}
      </div>

      {/* Control Toggles */}
      <div className="flex space-x-4 mb-4">
        <label className="flex items-center space-x-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showAnomalies}
            onChange={(e) => setShowAnomalies(e.target.checked)}
            className="rounded text-blue-600"
          />
          <span className="text-sm text-gray-700">Show Anomalies</span>
        </label>
        <label className="flex items-center space-x-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showTrend}
            onChange={(e) => setShowTrend(e.target.checked)}
            className="rounded text-blue-600"
          />
          <span className="text-sm text-gray-700">Show Trend Line</span>
        </label>
      </div>

      {/* Main Chart */}
      <div className="h-96">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={processedData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={currentMetric.color} stopOpacity={0.8}/>
                <stop offset="95%" stopColor={currentMetric.color} stopOpacity={0.1}/>
              </linearGradient>
            </defs>
            
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            
            <XAxis
              dataKey="timestamp"
              tickFormatter={(time) => format(new Date(time), 'HH:mm')}
              stroke="#6B7280"
              tick={{ fontSize: 12 }}
            />
            
            <YAxis
              stroke="#6B7280"
              tick={{ fontSize: 12 }}
              label={{ value: currentMetric.unit, angle: -90, position: 'insideLeft' }}
            />
            
            <Tooltip content={<CustomTooltip />} />
            
            <Legend />
            
            {/* Anomaly bounds */}
            {showAnomalies && processedData.length > 0 && (
              <>
                <ReferenceLine
                  y={processedData[0]?.upperBound}
                  stroke="#EF4444"
                  strokeDasharray="5 5"
                  label="Upper Bound"
                />
                <ReferenceLine
                  y={processedData[0]?.lowerBound}
                  stroke="#EF4444"
                  strokeDasharray="5 5"
                  label="Lower Bound"
                />
              </>
            )}
            
            {/* Highlight anomaly regions */}
            {showAnomalies && processedData.map((point, index) => {
              if (point.isAnomaly && index > 0) {
                return (
                  <ReferenceArea
                    key={index}
                    x1={processedData[index - 1].timestamp}
                    x2={point.timestamp}
                    fill={Math.abs(point.zScore) > 3 ? '#EF4444' : '#F59E0B'}
                    fillOpacity={0.1}
                  />
                );
              }
              return null;
            })}
            
            {/* Main data area */}
            <Area
              type="monotone"
              dataKey="value"
              stroke={currentMetric.color}
              fill="url(#colorValue)"
              strokeWidth={2}
              name={currentMetric.label}
              dot={showAnomalies ? <CustomDot /> : false}
            />
            
            {/* Trend line */}
            {showTrend && (
              <Line
                type="monotone"
                dataKey="movingAvg"
                stroke="#6B7280"
                strokeWidth={2}
                strokeDasharray="5 5"
                name="Moving Average"
                dot={false}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Anomaly Details */}
      {anomalyStats.total > 0 && (
        <div className="mt-4 p-4 bg-yellow-50 rounded-lg">
          <h4 className="text-sm font-semibold text-gray-900 mb-2">
            Detected Anomalies
          </h4>
          <div className="space-y-2">
            {processedData.filter(d => d.isAnomaly).slice(-5).map((anomaly, index) => (
              <div key={index} className="flex items-center justify-between text-sm">
                <span className="text-gray-700">
                  {format(new Date(anomaly.timestamp), 'MMM dd, HH:mm')}
                </span>
                <span className={`font-medium ${
                  Math.abs(anomaly.zScore) > 3 ? 'text-red-600' : 'text-yellow-600'
                }`}>
                  {anomaly.value} {currentMetric.unit} (z-score: {anomaly.zScore.toFixed(2)})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TimeSeriesAnalytics;