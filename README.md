# RedSync

**Predict shortages. Connect resources. Save lives.**

## Overview

RedSync is a centralized blood inventory intelligence dashboard prototype designed to help blood banks and hospitals monitor blood inventory, analyze consumption patterns, identify potential shortages, and explore simulated availability matching across institutions.

> **Prototype Notice:** This is a hackathon prototype using fictional institutions and simulated local mock data. It does not use real patient information or real hospital integrations.

## Problem Statement

Blood banks and hospitals often lack a centralized way to monitor blood inventory, analyze consumption patterns, identify potential shortages, and coordinate availability across institutions. Siloed systems and manual coordination slow down response times when blood-type deficits occur.

## Proposed Solution

RedSync provides a unified healthcare analytics interface that brings together network-wide inventory visibility, simulated 7-day demand forecasting, consumption analytics, shortage alerting, and simulated institution-to-institution availability matching.

## Key Features

- **Overview Dashboard:** Network KPIs, inventory distribution, 7-day demand trends, blood-group stock comparisons, recent alerts, and shortage summaries.
- **Inventory Management:** Searchable and filterable table across all 8 blood groups (`O+`, `O-`, `A+`, `A-`, `B+`, `B-`, `AB+`, `AB-`) and fictional institutions.
- **Predictions (Simulated):** Simulated 7-day estimated demand, projected inventory trajectory, safety buffer coverage, and blood-group risk levels.
- **Network Directory:** Searchable directory of fictional hospitals, trauma centers, and regional blood banks with per-site inventory summaries.
- **Simulated Matching:** Interactive lookup to check potential simulated availability by blood group and requested quantity (demonstration only).
- **Analytics:** Inventory distribution, departmental consumption patterns, historical vs. projected demand trends, and blood-group statistics.
- **Alerts:** Priority-filtered low inventory warnings and simulated projected shortage alerts with acknowledgement tracking.

## Technology Stack

- **Frontend:** React 18, Vite
- **Language:** JavaScript (ES Modules)
- **Charts:** Chart.js, `react-chartjs-2`
- **Icons:** `lucide-react`
- **Styling:** Custom CSS design system
- **Data:** Local fictional mock dataset (`src/data/mockData.js`)

## Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd RedSync
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

## Local Development

Start the development server:
```bash
npm run dev
```

Build for production:
```bash
npm run build
```

Preview the production build:
```bash
npm run preview
```

## Project Status

**Hackathon Prototype (Frontend Complete)** — All 7 core views, interactive filters, simulated matching, and Chart.js visualizations are implemented using local mock data. Backend APIs and live hospital integrations are intentionally out of scope for this prototype.
