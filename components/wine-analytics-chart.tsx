'use client';

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from 'recharts';

interface ChartData {
  type?: 'bar' | 'pie' | 'line' | 'table';
  data?: Array<{
    x: string | number;
    y: number;
    label: string;
    value: number;
  }>;
}

interface WineAnalyticsChartProps {
  title: string;
  description: string;
  chartData?: ChartData | any[];
  data: any[];
  summary?: string;
  chartType?: 'bar' | 'pie' | 'line' | 'table';
  xField?: string;
  yField?: string;
  colorField?: string;
  insights?: string;
}

const COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  '#82ca9d',
  '#ffc658',
  '#ff7c7c',
  '#8dd1e1',
];

export function WineAnalyticsChart({
  title,
  description,
  chartData,
  data,
  summary,
  chartType,
  xField,
  yField,
  colorField,
  insights,
}: WineAnalyticsChartProps) {
  // Handle both old and new data formats
  const actualChartData = Array.isArray(chartData) ? chartData : chartData?.data || [];
  const actualChartType = chartType || chartData?.type || 'table';
  
  const renderChart = () => {
    switch (actualChartType) {
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={actualChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey={xField || "label"} 
                angle={-45}
                textAnchor="end"
                height={80}
                fontSize={12}
              />
              <YAxis />
              <Tooltip 
                formatter={(value, name) => [value, yField || 'Count']}
                labelFormatter={(label) => `${label}`}
              />
              <Bar dataKey={yField || "value"} fill="hsl(var(--primary))" />
            </BarChart>
          </ResponsiveContainer>
        );

      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <PieChart>
              <Pie
                data={actualChartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ [xField || "label"]: label, percent }) => `${label} ${(percent * 100).toFixed(0)}%`}
                outerRadius={120}
                fill="#8884d8"
                dataKey={yField || "value"}
              >
                {actualChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value, name) => [value, yField || 'Bottles']} />
            </PieChart>
          </ResponsiveContainer>
        );

      case 'line':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={actualChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={xField || "label"} />
              <YAxis />
              <Tooltip 
                formatter={(value, name) => [value, yField || 'Count']}
                labelFormatter={(label) => `${xField || 'Category'}: ${label}`}
              />
              <Line type="monotone" dataKey={yField || "value"} stroke="hsl(var(--primary))" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        );

      case 'table':
      default:
        return (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {Object.keys(data[0] || {}).map((header) => (
                    <th
                      key={header}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      {header.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data.map((row, index) => (
                  <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    {Object.values(row).map((value, cellIndex) => (
                      <td key={cellIndex} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {typeof value === 'number' && value % 1 !== 0 
                          ? value.toFixed(2) 
                          : String(value)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto bg-white rounded-lg border border-gray-200 shadow-sm">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
        <p className="text-sm text-gray-600 mb-4">{description}</p>
        {(summary || insights) && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
            <p className="text-sm text-blue-900">{insights || summary}</p>
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="p-6">
        {renderChart()}
      </div>

      {/* Raw Data Summary */}
      {data.length > 0 && actualChartType !== 'table' && (
        <div className="px-6 pb-6">
          <details className="group">
            <summary className="text-sm font-medium text-gray-700 cursor-pointer hover:text-gray-900">
              View Raw Data ({data.length} items)
            </summary>
            <div className="mt-3 max-h-48 overflow-y-auto">
              <pre className="text-xs bg-gray-50 p-3 rounded border overflow-x-auto">
                {JSON.stringify(data, null, 2)}
              </pre>
            </div>
          </details>
        </div>
      )}
    </div>
  );
}