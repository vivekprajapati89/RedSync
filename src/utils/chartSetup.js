import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// Consistent blood-group color palette used across all charts
export const BLOOD_GROUP_COLORS = {
  'O+': '#991b1b',
  'O-': '#dc2626',
  'A+': '#b91c1c',
  'A-': '#ef4444',
  'B+': '#334155',
  'B-': '#64748b',
  'AB+': '#94a3b8',
  'AB-': '#cbd5e1',
};

export const BASE_CHART_OPTIONS = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: {
    mode: 'index',
    intersect: false,
  },
  plugins: {
    legend: {
      position: 'bottom',
      labels: {
        boxWidth: 12,
        boxHeight: 12,
        padding: 14,
        color: '#4b5563',
        font: {
          family: 'Inter, system-ui, sans-serif',
          size: 12,
        },
      },
    },
    tooltip: {
      backgroundColor: '#111827',
      titleColor: '#ffffff',
      bodyColor: '#f3f4f6',
      padding: 10,
      cornerRadius: 6,
      titleFont: { family: 'Inter, system-ui, sans-serif', size: 12, weight: '600' },
      bodyFont: { family: 'Inter, system-ui, sans-serif', size: 12 },
    },
  },
};
